"""
专家管理服务层
处理专家相关的业务逻辑
"""
import json
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional

from utils.unified_logger import get_logger

logger = get_logger(__name__)


class ExpertService:
    """专家管理服务"""
    
    def __init__(self):
        # 数据文件路径 - 保存到config目录
        self.config_dir = Path(__file__).parent.parent / "cfg"
        self.experts_file = self.config_dir / "experts.json"
        # 确保config目录存在
        self.config_dir.mkdir(exist_ok=True)
    
    def load_experts(self) -> List[Dict[str, Any]]:
        """从配置文件加载专家数据"""
        if not self.experts_file.exists():
            # 如果配置文件不存在，返回空列表
            return []
        
        with open(self.experts_file, 'r', encoding='utf-8') as f:
            experts = json.load(f)
            # 确保所有专家都有icon字段（向后兼容）
            has_update = False
            for expert in experts:
                if 'icon' not in expert:
                    expert['icon'] = '🔮'
                    has_update = True
            # 如果有更新，保存回文件
            if has_update:
                self.save_experts(experts)
            return experts
    
    def save_experts(self, experts: List[Dict[str, Any]]) -> None:
        """保存专家数据"""
        with open(self.experts_file, 'w', encoding='utf-8') as f:
            json.dump(experts, f, ensure_ascii=False, indent=2)
    
    def get_expert_by_id(self, expert_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取专家信息"""
        experts = self.load_experts()
        return next((e for e in experts if e.get("id") == expert_id), None)
    
    def get_all_experts(self) -> List[Dict[str, Any]]:
        """获取所有专家列表"""
        return self.load_experts()
    
    def create_expert(self, expert_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建新专家"""
        experts = self.load_experts()
        
        # 使用UUID生成专家ID
        expert_id = str(uuid.uuid4())
        
        # UUID理论上是唯一的，但为了安全起见，还是检查一下
        while any(e.get("id") == expert_id for e in experts):
            expert_id = str(uuid.uuid4())
        
        new_expert = {
            "id": expert_id,
            "name": expert_data.get("name", ""),
            "skills": expert_data.get("skills", ""),
            "prompt": expert_data.get("prompt", ""),
            "icon": expert_data.get("icon", "🔮"),
            "required_fields": expert_data.get("required_fields", [])
        }
        experts.append(new_expert)
        self.save_experts(experts)
        return new_expert
    
    def update_expert(self, expert_id: str, expert_data: Dict[str, Any]) -> Dict[str, Any]:
        """更新专家信息"""
        experts = self.load_experts()
        expert = next((e for e in experts if e.get("id") == expert_id), None)
        
        if not expert:
            return None
        
        # 更新字段
        if "name" in expert_data and expert_data["name"] is not None:
            expert["name"] = expert_data["name"]
        if "skills" in expert_data and expert_data["skills"] is not None:
            expert["skills"] = expert_data["skills"]
        if "icon" in expert_data and expert_data["icon"] is not None:
            expert["icon"] = expert_data["icon"]
        
        # prompt字段：无论值是什么（包括None和空字符串），都更新
        if "prompt" in expert_data:
            expert["prompt"] = expert_data["prompt"] if expert_data["prompt"] is not None else ""
        
        # required_fields字段：如果请求中包含该字段，则更新
        if "required_fields" in expert_data and expert_data["required_fields"] is not None:
            expert["required_fields"] = expert_data["required_fields"]
        
        self.save_experts(experts)
        return expert
    
    def delete_expert(self, expert_id: str) -> bool:
        """删除专家"""
        experts = self.load_experts()
        expert = next((e for e in experts if e.get("id") == expert_id), None)
        
        if not expert:
            return False
        
        experts.remove(expert)
        self.save_experts(experts)
        return True

