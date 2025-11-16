"""
命理分析服务层
处理命理分析相关的业务逻辑
"""
import base64
import json
from typing import List, Dict, Any, Optional, AsyncIterator
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from starlette.datastructures import UploadFile

from graph.fate_graph import FateGraph
from services.expert_service import ExpertService
from utils.unified_logger import get_logger

logger = get_logger(__name__)


class FortuneService:
    """命理分析服务"""
    
    def __init__(self):
        self.expert_service = ExpertService()
    
    def get_expert_by_id(self, expert_id: str, experts: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """根据ID获取专家配置"""
        return next((e for e in experts if e.get("id") == expert_id), None)
    
    def extract_field_value_from_form(
        self,
        form_data: Dict[str, Any],
        field: Dict[str, Any],
        uploaded_files: Dict[str, UploadFile]
    ) -> Optional[str]:
        """
        从表单数据中提取字段值
        对于 image 类型，转换为 base64 字符串返回（避免序列化问题）
        对于其他类型，返回字符串
        """
        field_id = field.get("field_id", "")
        field_type = field.get("field_type", "text")
        
        if not field_id:
            return None
        
        # 检查上传文件（优先检查，因为 image 类型应该是文件）
        if field_id in uploaded_files:
            file = uploaded_files[field_id]
            file_content = file.file.read()
            file.file.seek(0)  # 重置文件指针
            
            if field_type == "image":
                # image 类型转换为 base64 字符串（可序列化）
                base64_content = base64.b64encode(file_content).decode('utf-8')
                return base64_content
            else:
                # 非 image 类型，读取内容转换为字符串
                return file_content.decode('utf-8', errors='ignore')
        
        # 检查表单数据（文本字段）
        if field_id in form_data:
            value = form_data[field_id]
            if field_type == "image" and isinstance(value, str):
                # 如果是 base64 字符串，直接返回
                return value
            return str(value) if value else None
        
        return None
    
    def build_user_data(
        self,
        selected_experts: List[Dict[str, Any]],
        form_data: Dict[str, Any],
        uploaded_files: Dict[str, UploadFile]
    ) -> Dict[str, Dict[str, Any]]:
        """
        构建用户数据，根据专家配置动态提取字段
        返回格式: {expert_id: {field_id: field_value}}
        """
        user_data = {}
        
        for expert in selected_experts:
            expert_user_data = {}
            required_fields = expert.get("required_fields", [])
            
            for field in required_fields:
                if not isinstance(field, dict):
                    continue
                
                field_id = field.get("field_id", "")
                field_value = self.extract_field_value_from_form(form_data, field, uploaded_files)
                
                if field_value is not None:
                    expert_user_data[field_id] = field_value
                else:
                    logger.warning(f"专家 {expert.get('name')} 的字段 {field.get('field_name')} ({field_id}) 未找到对应数据")
            
            if expert_user_data:
                user_data[expert.get("id")] = expert_user_data
        
        return user_data
    
    def get_expert_list(self, expert_ids: Optional[List[str]]) -> List[Dict[str, Any]]:
        """
        获取专家列表
        如果提供了专家ID列表，返回对应的专家配置
        如果没有提供，返回空列表
        """
        if not expert_ids:
            return []
        
        # 加载专家配置
        experts = self.expert_service.load_experts()
        if not experts:
            raise HTTPException(status_code=500, detail="未找到专家配置")
        
        # 验证专家ID是否存在
        selected_experts = []
        for expert_id in expert_ids:
            expert_config = self.get_expert_by_id(expert_id, experts)
            if not expert_config:
                raise HTTPException(status_code=404, detail=f"未找到专家: {expert_id}")
            selected_experts.append(expert_config)
        
        if not selected_experts:
            raise HTTPException(status_code=400, detail="至少需要选择一个专家")
        
        return selected_experts
    
    def parse_form_parameters(
        self,
        form_data: Dict[str, Any],
        uploaded_files: Dict[str, UploadFile],
        selected_experts: List[Dict[str, Any]]
    ) -> tuple[Dict[str, Any], Dict[str, UploadFile]]:
        """
        解析表单参数，只保留专家需要的字段
        """
        expert_form_data = {}
        expert_uploaded_files = {}
        
        all_field_ids = set()
        for expert_config in selected_experts:
            required_fields = expert_config.get("required_fields", [])
            for field in required_fields:
                if not isinstance(field, dict) or "field_id" not in field:
                    continue
                all_field_ids.add(field.get("field_id"))
        
        # 如果指定了专家，只接受专家配置的字段
        # 如果没有指定专家，接受所有字段
        if selected_experts:
            for key in form_data.keys():
                if key in all_field_ids:
                    expert_form_data[key] = form_data[key]
            for key in uploaded_files.keys():
                if key in all_field_ids:
                    expert_uploaded_files[key] = uploaded_files[key]
        else:
            expert_form_data = form_data
            expert_uploaded_files = uploaded_files
        
        return expert_form_data, expert_uploaded_files
    
    async def analyze_fortune_stream(
        self,
        task_id: str,
        selected_experts: List[Dict[str, Any]],
        user_data: Dict[str, Dict[str, Any]]
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        执行命理分析并流式返回结果
        """
        try:
            fate_graph = FateGraph(analysis_experts=selected_experts)
            async for chunk in fate_graph.chat_with_planning_stream(task_id, user_data):
                yield chunk
        except Exception as e:
            logger.error(f"流式处理失败: {str(e)}")
            yield {
                "step": "error",
                "message": f"流式处理失败: {str(e)}"
            }
    
    def create_streaming_response(self, stream_generator: AsyncIterator[Dict[str, Any]]) -> StreamingResponse:
        """
        创建流式响应
        """
        async def generate_stream():
            """流式输出"""
            try:
                async for chunk in stream_generator:
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            except Exception as e:
                error_chunk = {
                    "step": "error",
                    "message": f"流式处理失败: {str(e)}"
                }
                yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )

