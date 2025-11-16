"""
命理分析Controller层
处理HTTP请求，调用Service层处理业务逻辑
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from starlette.datastructures import UploadFile

from services.fortune_service import FortuneService
from utils.unified_logger import get_logger

# 创建路由器
router = APIRouter(prefix="/api/fortune", tags=["fortune"])

logger = get_logger(__name__)

# 初始化服务
fortune_service = FortuneService()


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
        # 获取专家列表
        selected_experts = fortune_service.get_expert_list(expert)
        
        # 解析表单数据
        form = await request.form()
        form_data = {}
        uploaded_files = {}
        
        for key, value in form.items():
            if isinstance(value, UploadFile):
                uploaded_files[key] = value
            else:
                form_data[key] = value
        
        # 解析专家需要的参数
        expert_form_data, expert_uploaded_files = fortune_service.parse_form_parameters(
            form_data, uploaded_files, selected_experts
        )
        
        # 构建用户数据
        user_data = fortune_service.build_user_data(
            selected_experts, expert_form_data, expert_uploaded_files
        )
        
        if not user_data:
            raise HTTPException(status_code=400, detail="未找到任何有效的用户数据")
        
        # 执行分析并返回流式响应
        stream_generator = fortune_service.analyze_fortune_stream(
            task_id, selected_experts, user_data
        )
        
        return fortune_service.create_streaming_response(stream_generator)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"命理分析失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"{str(e)}")