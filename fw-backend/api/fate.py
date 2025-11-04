"""
命理分析API
提供命理分析接口
"""
import base64
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from starlette.datastructures import UploadFile
from datetime import datetime
import json

from graph.fate_graph import FateGraph
from api.expert import load_experts
from utils.unified_logger import get_logger

# 创建路由器
router = APIRouter(prefix="/api/fortune", tags=["fortune"])

logger = get_logger(__name__)


def get_expert_by_id(expert_id: str, experts: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """根据ID获取专家配置"""
    return next((e for e in experts if e.get("id") == expert_id), None)


def extract_field_value_from_form(
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
            field_value = extract_field_value_from_form(form_data, field, uploaded_files)
            
            if field_value is not None:
                expert_user_data[field_id] = field_value
            else:
                logger.warning(f"专家 {expert.get('name')} 的字段 {field.get('field_name')} ({field_id}) 未找到对应数据")
        
        if expert_user_data:
            user_data[expert.get("id")] = expert_user_data
    
    return user_data


@router.post("/analyze")
async def analyze_fortune(
    request: Request,
    expert: Optional[List[str]] = Query(None, description="专家ID列表（查询参数）"),
    task_id: str = Query(..., description="任务ID（必需参数）"),
):
    """
    命理分析接口（流式返回）
    
    根据选定的专家配置，动态处理表单数据并进行命理分析
    使用Server-Sent Events流式返回最终分析结果
    专家ID从查询参数（expert）获取
    """
    try:
        selected_experts = get_export_list(expert)
        form_data, uploaded_files = await get_parameters(request, selected_experts)
        user_data = build_user_data(selected_experts, form_data, uploaded_files)
        
        if not user_data:
            raise HTTPException(status_code=400, detail="未找到任何有效的用户数据")

        async def generate_stream():
            """流式输出"""
            try:
                fate_graph = FateGraph(analysis_experts=selected_experts)
                async for chunk in fate_graph.chat_with_planning_stream(task_id, user_data):
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            except Exception as e:
                error_chunk = {
                    "step": "error",
                    "message": f"流式处理失败: {str(e)}"
                }
                yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
        return return_response(generate_stream())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{str(e)}")


async def get_parameters(request, selected_experts):
    # 解析 multipart/form-data 请求，动态获取所有字段
    form_data = {}
    uploaded_files = {}

    all_field_ids = set()
    for expert_config in selected_experts:
        required_fields = expert_config.get("required_fields", [])
        for field in required_fields:
            if not isinstance(field, dict) or "field_id" not in field:
                continue
            all_field_ids.add(field.get("field_id"))

    form = await request.form()
    for key, value in form.items():
        if key in all_field_ids:
            if isinstance(value, UploadFile):
                uploaded_files[key] = value
            else:
                form_data[key] = value
    return form_data, uploaded_files


def get_export_list(expert):
    # 获取专家ID列表
    expert_ids = expert if expert else []
    if not expert_ids:
        raise HTTPException(status_code=400, detail="未指定专家ID，请通过查询参数 expert 提供")
    # 加载专家配置
    experts = load_experts()
    if not experts:
        raise HTTPException(status_code=500, detail="未找到专家配置")
    # 验证专家ID是否存在
    selected_experts = []
    for expert_id in expert_ids:
        expert_config = get_expert_by_id(expert_id, experts)
        if not expert_config:
            raise HTTPException(status_code=404, detail=f"未找到专家: {expert_id}")
        selected_experts.append(expert_config)
    if not selected_experts:
        raise HTTPException(status_code=400, detail="至少需要选择一个专家")
    return selected_experts


def return_response(func):
    return StreamingResponse(
        func,
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )