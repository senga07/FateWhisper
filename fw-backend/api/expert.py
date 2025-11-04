"""
专家管理API
提供专家的CRUD操作
"""
import json
import uuid
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# 创建路由器
router = APIRouter(prefix="/api/expert", tags=["expert"])

# 数据文件路径 - 保存到config目录
CONFIG_DIR = Path(__file__).parent.parent / "cfg"
EXPERTS_FILE = CONFIG_DIR / "experts.json"

# 确保config目录存在
CONFIG_DIR.mkdir(exist_ok=True)


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


def load_experts() -> List[dict]:
    """从配置文件加载专家数据"""
    if not EXPERTS_FILE.exists():
        # 如果配置文件不存在，返回空列表
        return []
    
    with open(EXPERTS_FILE, 'r', encoding='utf-8') as f:
        experts = json.load(f)
        # 确保所有专家都有icon字段（向后兼容）
        has_update = False
        for expert in experts:
            if 'icon' not in expert:
                expert['icon'] = '🔮'
                has_update = True
        # 如果有更新，保存回文件
        if has_update:
            save_experts(experts)
        return experts


def save_experts(experts: List[dict]):
    """保存专家数据"""
    with open(EXPERTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(experts, f, ensure_ascii=False, indent=2)


@router.get("/list", response_model=List[ExpertResponse])
async def get_experts():
    """获取所有专家列表"""
    experts = load_experts()
    return experts


@router.get("/{expert_id}", response_model=ExpertResponse)
async def get_expert(expert_id: str):
    """根据ID获取专家信息"""
    experts = load_experts()
    expert = next((e for e in experts if e["id"] == expert_id), None)
    if not expert:
        raise HTTPException(status_code=404, detail="专家不存在")
    return expert


@router.post("/create", response_model=ExpertResponse)
async def create_expert(expert: ExpertCreate):
    """创建新专家"""
    experts = load_experts()
    
    # 使用UUID生成专家ID
    expert_id = str(uuid.uuid4())
    
    # UUID理论上是唯一的，但为了安全起见，还是检查一下
    while any(e["id"] == expert_id for e in experts):
        expert_id = str(uuid.uuid4())
    
    new_expert = {
        "id": expert_id,
        "name": expert.name,
        "skills": expert.skills,
        "prompt": expert.prompt or "",
        "icon": expert.icon or "🔮",
        "required_fields": expert.required_fields or []
    }
    experts.append(new_expert)
    save_experts(experts)
    return new_expert


@router.put("/{expert_id}", response_model=ExpertResponse)
async def update_expert(expert_id: str, expert_update: ExpertUpdate):
    """更新专家信息"""
    experts = load_experts()
    expert = next((e for e in experts if e["id"] == expert_id), None)
    if not expert:
        raise HTTPException(status_code=404, detail="专家不存在")
    
    if expert_update.name is not None:
        expert["name"] = expert_update.name
    if expert_update.skills is not None:
        expert["skills"] = expert_update.skills
    if expert_update.icon is not None:
        expert["icon"] = expert_update.icon
    
    # prompt字段：无论值是什么（包括None和空字符串），都更新
    # 因为前端总是会发送prompt字段
    expert["prompt"] = expert_update.prompt if expert_update.prompt is not None else ""
    
    # required_fields字段：如果请求中包含该字段，则更新
    if expert_update.required_fields is not None:
        expert["required_fields"] = expert_update.required_fields
    
    save_experts(experts)
    return expert


@router.delete("/{expert_id}")
async def delete_expert(expert_id: str):
    """删除专家"""
    experts = load_experts()
    expert = next((e for e in experts if e["id"] == expert_id), None)
    if not expert:
        raise HTTPException(status_code=404, detail="专家不存在")
    
    experts.remove(expert)
    save_experts(experts)
    return {"message": "专家已删除"}

