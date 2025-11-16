"""
专家管理Controller层
处理HTTP请求，调用Service层处理业务逻辑
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.expert_service import ExpertService
from utils.unified_logger import get_logger

# 创建路由器
router = APIRouter(prefix="/api/expert", tags=["expert"])

logger = get_logger(__name__)

# 初始化服务
expert_service = ExpertService()


class ExpertCreate(BaseModel):
    """创建专家请求模型"""
    name: str
    skills: str
    prompt: Optional[str] = ""
    icon: Optional[str] = "🔮"
    required_fields: Optional[List[Dict[str, Any]]] = []


class ExpertUpdate(BaseModel):
    """更新专家请求模型"""
    name: Optional[str] = None
    skills: Optional[str] = None
    prompt: Optional[str] = None
    icon: Optional[str] = None
    required_fields: Optional[List[Dict[str, Any]]] = None


class ExpertResponse(BaseModel):
    """专家响应模型"""
    id: str
    name: str
    skills: str
    prompt: Optional[str] = ""
    icon: Optional[str] = "🔮"
    required_fields: Optional[List[Dict[str, Any]]] = []


@router.get("/list", response_model=List[ExpertResponse])
async def get_experts():
    """获取所有专家列表"""
    try:
        experts = expert_service.get_all_experts()
        return experts
    except Exception as e:
        logger.error(f"获取专家列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取专家列表失败: {str(e)}")


@router.get("/{expert_id}", response_model=ExpertResponse)
async def get_expert(expert_id: str):
    """根据ID获取专家信息"""
    try:
        expert = expert_service.get_expert_by_id(expert_id)
        if not expert:
            raise HTTPException(status_code=404, detail="专家不存在")
        return expert
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取专家信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取专家信息失败: {str(e)}")


@router.post("/create", response_model=ExpertResponse)
async def create_expert(expert: ExpertCreate):
    """创建新专家"""
    try:
        expert_data = {
            "name": expert.name,
            "skills": expert.skills,
            "prompt": expert.prompt or "",
            "icon": expert.icon or "🔮",
            "required_fields": expert.required_fields or []
        }
        new_expert = expert_service.create_expert(expert_data)
        return new_expert
    except Exception as e:
        logger.error(f"创建专家失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建专家失败: {str(e)}")


@router.put("/{expert_id}", response_model=ExpertResponse)
async def update_expert(expert_id: str, expert_update: ExpertUpdate):
    """更新专家信息"""
    try:
        expert_data = {}
        if expert_update.name is not None:
            expert_data["name"] = expert_update.name
        if expert_update.skills is not None:
            expert_data["skills"] = expert_update.skills
        if expert_update.icon is not None:
            expert_data["icon"] = expert_update.icon
        if expert_update.prompt is not None:
            expert_data["prompt"] = expert_update.prompt
        if expert_update.required_fields is not None:
            expert_data["required_fields"] = expert_update.required_fields
        
        expert = expert_service.update_expert(expert_id, expert_data)
        if not expert:
            raise HTTPException(status_code=404, detail="专家不存在")
        return expert
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新专家失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新专家失败: {str(e)}")


@router.delete("/{expert_id}")
async def delete_expert(expert_id: str):
    """删除专家"""
    try:
        success = expert_service.delete_expert(expert_id)
        if not success:
            raise HTTPException(status_code=404, detail="专家不存在")
        return {"message": "专家已删除"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除专家失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除专家失败: {str(e)}")

