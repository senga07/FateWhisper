from typing import List, TypedDict, Dict, Any, Optional, Annotated
from datetime import datetime
from typing import List, AsyncIterator
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph

from services.service_manager import service_manager
from utils.custom_serializer import CustomSerializer
from utils.unified_logger import get_logger
from tools.bazi_tools import tian_gan_di_zhi


def merge_dicts(left: Dict[str, Any], right: Dict[str, Any]) -> Dict[str, Any]:
    """合并两个字典，用于并行节点更新 expert_reports"""
    logger = get_logger(__name__)
    logger.info(f"合并字典: left={list(left.keys())}, right={list(right.keys())}")
    result = left.copy()
    result.update(right)
    logger.info(f"合并后: {list(result.keys())}")
    return result


def merge_lists(left: List[Dict[str, Any]], right: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """合并两个列表，用于并行节点更新 streaming_chunks"""
    return left + right


class FateGraphState(TypedDict):
    user_data: Dict[str, Any]
    streaming_chunks: Annotated[List[Dict[str, Any]], merge_lists]
    expert_reports: Annotated[Dict[str, Any], merge_dicts]


class FateGraph():
    def __init__(self, analysis_experts: Optional[List[Dict[str, Any]]] = None):

        self.logger = get_logger(__name__)
        self.config = service_manager.get_config()
        llms = service_manager.get_llms()
        self.fast_llm = llms.get('fast_llm')
        self.vision_llm = llms.get('vision_llm')
        self.store = service_manager.store
        self.checkpointer = MemorySaver(serde=CustomSerializer())
        self.analysis_experts = analysis_experts
        self.graph = self._build_graph()

        self.logger.info("FateGraph 实例创建完成")


    def _build_graph(self) -> CompiledStateGraph:
        """构建并行专家分析图"""
        if not self.analysis_experts:
            raise ValueError("专家列表不能为空")

        workflow = StateGraph(FateGraphState)

        # 添加专家节点和汇聚节点
        expert_node_names = []
        for expert_config in self.analysis_experts:
            expert_id = expert_config.get("id")
            expert_node = self._create_expert_node_factory(expert_config)
            workflow.add_node(expert_id, expert_node)
            expert_node_names.append(expert_id)
        workflow.add_node("collect", self._collect_node)

        # 连接节点：START -> 各专家节点 -> collect -> END
        for node_name in expert_node_names:
            workflow.add_edge(START, node_name)
            workflow.add_edge(node_name, "collect")
        workflow.add_edge("collect", END)

        return workflow.compile(checkpointer=self.checkpointer)


    def _create_expert_node_factory(self, expert_config: Dict[str, Any]):
        """创建专家节点工厂函数，绑定专家配置"""

        async def expert_node(state: FateGraphState) -> FateGraphState:
            return await self._create_expert_node(state, expert_config)

        return expert_node


    def _parse_text_content(self, content: str) -> str:
        """
        解析并拼接文本内容
        处理数组格式：[{'text': '-'}, {'text': '内容1'}, {'text': '内容2'}, ...]
        """
        text_parts = []
        for item in content:
            if isinstance(item, dict) and 'text' in item:
                text_parts.append(item.get('text'))
        return ''.join(text_parts) if text_parts else ""


    async def _create_expert_node(self, state: FateGraphState, expert_config: Dict[str, Any]) -> FateGraphState:
        """专家节点函数，执行专家分析"""

        required_fields = expert_config.get("required_fields", [])
        expert_id = expert_config.get("id")
        expert_name = expert_config.get("name")

        expert_messages = []
        expert_messages.append(SystemMessage(content=expert_config.get("prompt")))

        expert_user_data = state.get("user_data").get(expert_id)
        for field in required_fields:
            if not isinstance(field, dict):
                continue

            field_type = field.get("field_type")
            field_id = field.get("field_id", "")
            field_name = field.get("field_name", "")
            field_value = expert_user_data.get(field_id)

            if field_type == "datetime":
                expert_messages.append(HumanMessage(content=self.caculate_bazi(field_name, field_value)))
            elif field_type == "image":
                expert_messages.append(HumanMessage(content=field_name))
                image_message = HumanMessage(
                    content=[
                        {
                            "type": "image",
                            "image": f"data:image/jpeg;base64,{field_value}"
                        }
                    ]
                )
                expert_messages.append(image_message)
            else:
                expert_messages.append(HumanMessage(content=field_name + "：" + field_value))
        needs_vision = any(
            field.get("field_type") == "image"
            for field in required_fields
            if isinstance(field, dict)
        )
        llm = self.vision_llm if needs_vision else self.fast_llm
        response = await llm.ainvoke(expert_messages)
        content = response.content if hasattr(response, 'content') else str(response)
        if needs_vision:
            content = self._parse_text_content(content)

        return self._process_result(expert_name, content, state)


    async def _collect_node(self, state: FateGraphState) -> FateGraphState:
        """汇聚节点，收集所有专家的分析结果并生成最终报告"""
        expert_reports = state.get("expert_reports", {})
        self.logger.info(f"收集节点收到 {len(expert_reports)} 个专家报告: {list(expert_reports.keys())}")
        summary_parts = []

        for expert_name, content in expert_reports.items():
            if content and content.strip():
                summary_parts.append(f"# {expert_name}分析\n\n{content}\n\n")

        final_report = list(expert_reports.values())[0]
        if len(expert_reports) > 1 and self.fast_llm and summary_parts:
            synthesis_prompt = SystemMessage(content="""你是一个命理分析师，擅长综合多个专家的分析结果，生成一份完整、专业的综合命理分析报告。

请根据以下各专家的分析结果，生成一份综合报告：
1. 整合各专家的观点，找出共同点和差异
2. 提供全面的命理分析
3. 给出综合性的建议和预测
4. 保持专业、客观的语调

报告格式要求（markdown）：
- 综合性格分析
- 综合事业分析
- 综合财运分析
- 综合婚姻分析
- 综合健康分析
- 综合未来趋势预测
- 综合建议""")
            summary_text = "\n".join(summary_parts)
            user_message = HumanMessage(content=f"以下是各专家的分析结果：\n\n{summary_text}\n\n请生成综合命理分析报告。")
            synthesis_response = await self.fast_llm.ainvoke([synthesis_prompt, user_message])
            final_report = f"# 综合命理分析报告\n\n{synthesis_response.content}"

        return self._process_result("命理师综合分析", final_report, state)


    def caculate_bazi(self, field_name, field_value) -> str:

        date_str = str(field_value).strip()
        date_formats = "%Y-%m-%d %H:%M"
        parsed_datetime = datetime.strptime(date_str, date_formats)

        bazi_info = ""
        if parsed_datetime:
            year = parsed_datetime.year
            month = parsed_datetime.month
            day = parsed_datetime.day
            hour = parsed_datetime.hour

            # 计算八字
            year_zhu, month_zhu, day_zhu, hour_zhu = tian_gan_di_zhi(year, month, day, hour)

            # 格式化八字信息
            bazi_info = f"{field_name}：{field_value}\n"
            bazi_info += f"八字：{year_zhu} {month_zhu} {day_zhu} {hour_zhu}"
            bazi_info += f"\n年柱：{year_zhu}，月柱：{month_zhu}，日柱：{day_zhu}，时柱：{hour_zhu}"
        return bazi_info


    def _process_result(self, expert_name, export_report, state):
        """处理执行结果，返回该节点要添加的部分状态"""
        self.logger.info(f"处理结果: 专家={expert_name}, 报告长度={len(export_report) if export_report else 0}")
        # 创建要添加的流式块
        chunk = {
            "expert_name": expert_name,
            "expert_report": export_report
        }

        result = {
            "expert_reports": {expert_name: export_report},
            "streaming_chunks": [chunk]
        }
        self.logger.info(f"返回部分状态: expert_reports keys={list(result['expert_reports'].keys())}")
        return result


    async def chat_with_planning_stream(self, task_id: str, user_data: Dict[str, Dict[str, Any]]) -> AsyncIterator[Dict[str, Any]]:
        """流式聊天接口 """

        initial_state = {
            "user_data": user_data,
            "streaming_chunks": [],
            "expert_reports":{}
        }
        config = RunnableConfig(configurable={"thread_id": task_id})
        events = self.graph.astream_events(initial_state, config=config)

        async for chunk in self.process_streaming_events(events):
            yield chunk


    async def process_streaming_events(self, events: AsyncIterator[Dict[str, Any]]) -> AsyncIterator[Dict[str, Any]]:
        """处理流式事件的公共方法"""
        try:
            # 用于跟踪已发送的专家报告，避免重复发送
            sent_experts = set()
            
            async for event in events:
                event_type = event.get('event', '')
                event_name = event.get('name', 'unknown')
                self.logger.info(f"收到event: {event_type} - {event_name}")

                # 对于每个节点的 on_chain_end 事件，发送该节点的流式块（实时发送）
                if event_type == "on_chain_end" and event_name != "LangGraph":
                    data = event.get("data", {})
                    chunk = data.get("chunk", {})
                    output = data.get("output", {})
                    
                    # 检查 chunk 中的 streaming_chunks（单个节点的输出）
                    if isinstance(chunk, dict) and "streaming_chunks" in chunk:
                        streaming_chunks = chunk["streaming_chunks"]
                        self.logger.info(f"节点 {event_name} 从chunk中找到 {len(streaming_chunks)} 个流式块")
                        for streaming_chunk in streaming_chunks:
                            expert_name = streaming_chunk.get("expert_name")
                            # 只发送专家报告，综合报告稍后发送
                            if expert_name and "综合" not in expert_name:
                                if expert_name not in sent_experts:
                                    sent_experts.add(expert_name)
                                    yield {
                                        "expert_name": expert_name,
                                        "expert_report": streaming_chunk.get("expert_report"),
                                    }
                    
                    # 检查 output 中的 streaming_chunks
                    if isinstance(output, dict) and "streaming_chunks" in output:
                        streaming_chunks = output["streaming_chunks"]
                        self.logger.info(f"节点 {event_name} 从output中找到 {len(streaming_chunks)} 个流式块")
                        for streaming_chunk in streaming_chunks:
                            expert_name = streaming_chunk.get("expert_name")
                            if expert_name and "综合" not in expert_name:
                                if expert_name not in sent_experts:
                                    sent_experts.add(expert_name)
                                    yield {
                                        "expert_name": expert_name,
                                        "expert_report": streaming_chunk.get("expert_report"),
                                    }
                
                # 对于整个图的 on_chain_end 事件，发送所有累积的流式块（包括综合报告）
                elif event_type == "on_chain_end" and event_name == "LangGraph":
                    data = event.get("data", {})
                    output = data.get("output", {})
                    
                    # 在 LangGraph 的最终输出中，应该包含所有节点的流式块
                    if isinstance(output, dict) and "streaming_chunks" in output:
                        streaming_chunks = output["streaming_chunks"]
                        self.logger.info(f"LangGraph最终输出中找到 {len(streaming_chunks)} 个流式块")
                        # 先发送所有专家报告（排除综合报告）
                        for streaming_chunk in streaming_chunks:
                            expert_name = streaming_chunk.get("expert_name")
                            expert_report = streaming_chunk.get("expert_report")
                            
                            # 如果是专家报告且未发送过，则发送
                            if expert_name and "综合" not in expert_name and expert_name not in sent_experts:
                                sent_experts.add(expert_name)
                                self.logger.info(f"从最终输出中发送专家报告: {expert_name}, 长度: {len(expert_report) if expert_report else 0}")
                                yield {
                                    "expert_name": expert_name,
                                    "expert_report": expert_report,
                                }
                        
                        # 最后发送综合报告
                        for streaming_chunk in streaming_chunks:
                            expert_name = streaming_chunk.get("expert_name")
                            expert_report = streaming_chunk.get("expert_report")
                            
                            # 如果是综合报告，总是发送
                            if expert_name and "综合" in expert_name:
                                self.logger.info(f"从最终输出中发送综合报告: {expert_name}, 长度: {len(expert_report) if expert_report else 0}")
                                yield {
                                    "expert_name": expert_name,
                                    "expert_report": expert_report,
                                }
                    
                    # 也检查 data 本身（作为备用）
                    if isinstance(data, dict) and "streaming_chunks" in data:
                        streaming_chunks = data["streaming_chunks"]
                        self.logger.info(f"LangGraph data中找到 {len(streaming_chunks)} 个流式块")
                        # 先发送专家报告
                        for streaming_chunk in streaming_chunks:
                            expert_name = streaming_chunk.get("expert_name")
                            expert_report = streaming_chunk.get("expert_report")
                            if expert_name and "综合" not in expert_name and expert_name not in sent_experts:
                                sent_experts.add(expert_name)
                                self.logger.info(f"从data中发送专家报告: {expert_name}")
                                yield {
                                    "expert_name": expert_name,
                                    "expert_report": expert_report,
                                }
                        # 再发送综合报告
                        for streaming_chunk in streaming_chunks:
                            expert_name = streaming_chunk.get("expert_name")
                            expert_report = streaming_chunk.get("expert_report")
                            if expert_name and "综合" in expert_name:
                                self.logger.info(f"从data中发送综合报告: {expert_name}")
                                yield {
                                    "expert_name": expert_name,
                                    "expert_report": expert_report,
                                }
        except Exception as e:
            self.logger.error(f"流式处理失败: {str(e)}")
            yield {
                "expert_name": "error",
                "expert_report": f" {str(e)}",
            }