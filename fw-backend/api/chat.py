"""
聊天API Controller层
处理HTTP请求，调用ChatService处理业务逻辑
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.chat_service import chat_service
from utils.unified_logger import get_logger

# 创建路由器
router = APIRouter(prefix="/api/chat", tags=["chat"])

logger = get_logger(__name__)


class CreateSessionRequest(BaseModel):
    """创建会话请求"""
    agent_id: str  # 必需参数
    customer_id: Optional[str] = None
    title: Optional[str] = None


class CreateEventRequest(BaseModel):
    """创建事件请求"""
    agent_id: str  # 必需参数
    kind: str
    source: str
    message: Optional[str] = None


@router.post("/sessions")
async def create_session(request: CreateSessionRequest):
    """创建聊天会话"""
    try:
        if not request.agent_id:
            raise HTTPException(status_code=400, detail="agent_id 是必需参数")
        session = await chat_service.create_session(
            agent_id=request.agent_id,
            customer_id=request.customer_id,
            title=request.title
        )
        return session
    except Exception as e:
        logger.error(f"创建会话失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/events")
async def create_event(session_id: str, request: CreateEventRequest):
    """创建事件（发送消息）"""
    try:
        if not request.agent_id:
            raise HTTPException(status_code=400, detail="agent_id 是必需参数")
        event_data = {
            "kind": request.kind,
            "source": request.source,
        }
        if request.message:
            event_data["message"] = request.message
        
        event = await chat_service.create_event(session_id, request.agent_id, event_data)
        return event
    except RuntimeError as e:
        # 处理会话不存在的情况
        error_msg = str(e)
        if "会话不存在" in error_msg or "已过期" in error_msg:
            logger.warning(f"会话不存在，无法创建事件: {session_id}")
            raise HTTPException(
                status_code=404,
                detail=f"会话不存在或已过期，请重新创建会话。会话ID: {session_id}"
            )
        logger.error(f"创建事件失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"创建事件失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/check")
async def check_session(session_id: str):
    """检查会话是否存在"""
    try:
        exists = await chat_service.check_session_exists(session_id)
        return {
            "session_id": session_id,
            "exists": exists,
            "message": "会话存在" if exists else "会话不存在或已过期"
        }
    except Exception as e:
        logger.error(f"检查会话失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/events")
async def list_events(
    session_id: str,
    agent_id: str = Query(..., description="Agent ID（必需参数）"),
    min_offset: int = Query(0, description="最小偏移量"),
    wait_for_data: int = Query(30, description="等待数据时间（秒）"),
    kinds: Optional[List[str]] = Query(None, description="事件类型过滤")
):
    """获取会话事件列表"""
    try:
        if not agent_id:
            raise HTTPException(status_code=400, detail="agent_id 是必需参数")
        events = await chat_service.list_events(
            session_id=session_id,
            agent_id=agent_id,
            min_offset=min_offset,
            wait_for_data=wait_for_data,
            kinds=kinds
        )
        return {"events": events}
    except RuntimeError as e:
        # 处理会话不存在的情况
        error_msg = str(e)
        if "会话不存在" in error_msg or "404" in error_msg:
            logger.warning(f"会话不存在: {session_id}")
            return {"events": [], "message": "会话不存在或已过期"}
        logger.error(f"获取事件列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"获取事件列表失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agent/info")
async def get_agent_info():
    """获取Agent信息"""
    try:
        # 先尝试从缓存获取
        agent_id = chat_service.get_agent_id()
        # 如果缓存中没有，从 Parlant 服务器获取
        if not agent_id:
            agent_id = await chat_service.fetch_agent_id()
        if not agent_id:
            raise HTTPException(status_code=503, detail="Agent 未初始化或 Parlant 服务器无可用 Agent")
        return {"agent_id": agent_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取Agent信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

