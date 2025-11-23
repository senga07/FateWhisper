"""
聊天服务 - 使用 Parlant 框架
"""
import asyncio
from typing import Optional, Dict, Any
import httpx
import parlant.sdk as p
from utils.fix_json_encoding import fix_parlant_json_encoding
from utils.unified_logger import get_logger

# 修复 JSON 编码问题
fix_parlant_json_encoding()

logger = get_logger(__name__)


class ChatService:
    """聊天服务 - 管理 Parlant Agent 和会话"""
    
    _instance = None
    _server: Optional[p.Server] = None
    _agent: Optional[p.Agent] = None
    _server_url: Optional[str] = None
    _server_context: Optional[Any] = None
    _initialized = False
    _cached_agent_id: Optional[str] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.logger = get_logger(__name__)
            self._initialized = True
    
    async def initialize(self) -> bool:
        """初始化 Parlant 服务连接
        
        注意：parlant Server 应该单独运行（通过 parlant_server.py 启动），
        我们的应用只是通过 HTTP 调用它的 REST API。
        """
        try:
            self.logger.info("正在初始化 Parlant 服务连接...")
            
            # parlant Server 应该单独运行在 8800 端口
            # 我们只需要配置 Server URL，不需要启动 Server
            self._server_url = "http://localhost:8800"
            
            # 测试连接，确保 parlant Server 正在运行
            self.logger.info(f"正在测试 parlant Server 连接: {self._server_url}")
            max_retries = 5
            connected = False
            
            for i in range(max_retries):
                try:
                    async with httpx.AsyncClient() as client:
                        # 尝试访问 parlant 的根路径
                        test_response = await client.get(
                            f"{self._server_url}/",
                            timeout=5.0
                        )
                        self.logger.info(f"✅ Parlant 服务器连接测试成功，状态码: {test_response.status_code}")
                        connected = True
                        break
                except httpx.ConnectError as e:
                    if i < max_retries - 1:
                        wait_time = min(i + 1, 2)  # 等待 1s, 2s, 2s...
                        self.logger.info(f"等待 parlant Server 启动... ({i+1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                    else:
                        self.logger.error(f"❌ Parlant 服务器连接失败: {e}")
                        self.logger.error("💡 请先启动 parlant Server:")
                        self.logger.error("   运行: python parlant_server.py")
                        self.logger.error("   确保 parlant Server 在 http://localhost:8800 运行")
                        self.logger.error("   查看日志: tail -f parlant-data/parlant.log")
                        # 不抛出异常，允许继续运行（用户可能稍后启动 Server）
                        self.logger.warning("⚠️ 继续运行，但聊天功能将无法使用，直到 parlant Server 启动")
                except Exception as e:
                    self.logger.warning(f"⚠️ 连接测试出现其他错误: {e}")
                    break
            
            if connected:
                self.logger.info(f"✅ Parlant 服务器连接成功，URL: {self._server_url}")
                # 尝试获取 agent ID
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(
                            f"{self._server_url}/agents",
                            timeout=5.0
                        )
                        response.raise_for_status()
                        agents = response.json()
                        if isinstance(agents, list) and len(agents) > 0:
                            self._cached_agent_id = agents[0].get("id")
                            self.logger.info(f"✅ 获取到 Agent ID: {self._cached_agent_id}")
                        else:
                            self.logger.warning("⚠️ Parlant 服务器没有可用的 Agent")
                except Exception as e:
                    self.logger.warning(f"⚠️ 获取 Agent ID 失败: {e}，将在首次使用时获取")
            else:
                self.logger.warning("⚠️ 无法连接到 parlant Server")
                self.logger.warning(f"⚠️ Server URL: {self._server_url}")
                self.logger.warning("💡 请运行: python parlant_server.py 启动 parlant Server")
            
            self.logger.info("✅ Parlant 服务初始化完成")
            return True
            
        except Exception as e:
            self.logger.error(f"初始化 Parlant 服务失败: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def cleanup(self):
        """清理资源"""
        try:
            # 由于 parlant Server 是单独运行的，我们不需要清理它
            self._server = None
            self._agent = None
            self._server_context = None
            
            self.logger.info("Parlant 服务已清理")
        except Exception as e:
            self.logger.error(f"清理 Parlant 服务时出错: {e}")
    
    def get_server(self) -> Optional[p.Server]:
        """获取 Parlant 服务器实例"""
        return self._server
    
    def get_agent(self) -> Optional[p.Agent]:
        """获取 Agent 实例"""
        return self._agent
    
    def get_agent_id(self) -> Optional[str]:
        """获取 Agent ID - 从缓存或 Parlant 服务器获取"""
        # 如果已缓存，直接返回
        if self._cached_agent_id:
            return self._cached_agent_id
        
        # 如果之前有 agent 实例，返回其 ID
        if self._agent:
            return self._agent.id
        
        # 否则返回 None（前端需要时可以通过 API 获取）
        return None
    
    async def fetch_agent_id(self) -> Optional[str]:
        """从 Parlant 服务器获取 Agent ID"""
        try:
            if not self._server_url:
                return None
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self._server_url}/agents",
                    timeout=5.0
                )
                response.raise_for_status()
                agents = response.json()
                if isinstance(agents, list) and len(agents) > 0:
                    agent_id = agents[0].get("id")
                    # 缓存 agent_id
                    self._cached_agent_id = agent_id
                    self.logger.info(f"✅ 获取到 Agent ID: {agent_id}")
                    return agent_id
                else:
                    self.logger.warning("⚠️ Parlant 服务器没有可用的 Agent")
                    return None
        except Exception as e:
            self.logger.error(f"获取 Agent ID 失败: {e}")
            return None
    
    async def create_session(self, agent_id: str, customer_id: Optional[str] = None, title: Optional[str] = None) -> Dict[str, Any]:
        """创建会话 - 通过 HTTP 调用 parlant REST API"""
        try:
            if not agent_id:
                raise RuntimeError("agent_id 是必需参数")
            
            if not self._server_url:
                raise RuntimeError("Server URL 未初始化")
            
            # 通过 HTTP 请求调用 parlant 的 REST API
            async with httpx.AsyncClient() as client:
                payload = {
                    "agent_id": agent_id,
                }
                if customer_id:
                    payload["customer_id"] = customer_id
                if title:
                    payload["title"] = title
                else:
                    payload["title"] = f"聊天会话 {asyncio.get_event_loop().time()}"
                
                response = await client.post(
                    f"{self._server_url}/sessions",
                    json=payload,
                    timeout=30.0
                )
                response.raise_for_status()
                session_data = response.json()
                
                self.logger.info(f"会话创建成功: {session_data.get('id')}, Agent ID: {agent_id}")
                return {
                    "id": session_data.get("id"),
                    "agent_id": agent_id,
                    "customer_id": customer_id,
                    "title": payload.get("title")
                }
        except Exception as e:
            self.logger.error(f"创建会话失败: {e}")
            raise
    
    async def create_event(self, session_id: str, agent_id: str, event_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """创建事件（发送消息）- 通过 HTTP 调用 parlant REST API"""
        try:
            if not self._server_url:
                raise RuntimeError("Server URL 未初始化")
            
            if not event_data:
                event_data = {}
            
            # 构建事件参数
            payload = {
                "kind": event_data.get("kind", "message"),
                "source": event_data.get("source", "customer"),
            }
            if "message" in event_data:
                payload["message"] = event_data["message"]
            
            # 通过 HTTP 请求调用 parlant 的 REST API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self._server_url}/sessions/{session_id}/events",
                    json=payload,
                    timeout=30.0
                )
                
                # 处理 404 错误（会话不存在）
                if response.status_code == 404:
                    self.logger.warning(f"会话不存在，无法创建事件: {session_id}")
                    raise RuntimeError(f"会话不存在或已过期: {session_id}")
                
                response.raise_for_status()
                event_data_resp = response.json()
                
                self.logger.info(f"事件创建成功: {event_data_resp.get('id')}")
                return {
                    "id": event_data_resp.get("id"),
                    "session_id": session_id,
                    "kind": payload.get("kind"),
                    "source": payload.get("source"),
                }
        except httpx.HTTPStatusError as e:
            # 处理其他 HTTP 错误
            if e.response.status_code == 404:
                self.logger.warning(f"会话不存在，无法创建事件: {session_id}")
                raise RuntimeError(f"会话不存在或已过期: {session_id}")
            self.logger.error(f"创建事件失败 (HTTP {e.response.status_code}): {e}")
            raise RuntimeError(f"创建事件失败: HTTP {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            self.logger.error(f"请求 Parlant 服务器失败: {e}")
            raise RuntimeError(f"无法连接到 Parlant 服务器: {str(e)}")
        except RuntimeError:
            # 重新抛出 RuntimeError（会话不存在）
            raise
        except Exception as e:
            self.logger.error(f"创建事件失败: {e}")
            raise
    
    async def check_session_exists(self, session_id: str) -> bool:
        """检查会话是否存在"""
        try:
            if not self._server_url:
                return False
            
            # 尝试获取会话事件列表，如果返回 404 则会话不存在
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self._server_url}/sessions/{session_id}/events",
                    params={"min_offset": 0, "wait_for_data": 0},
                )
                return response.status_code != 404
        except Exception as e:
            self.logger.warning(f"检查会话是否存在时出错: {e}")
            return False
    
    async def list_events(self, session_id: str, agent_id: str, min_offset: int = 0, wait_for_data: int = 30, kinds: Optional[list] = None) -> list:
        """获取会话事件列表 - 通过 HTTP 调用 parlant REST API"""
        try:
            if not self._server_url:
                raise RuntimeError("Server URL 未初始化")
            
            # 构建查询参数
            params = {
                "min_offset": min_offset,
                "wait_for_data": wait_for_data,
            }
            if kinds:
                params["kinds"] = kinds
            
            # 通过 HTTP 请求调用 parlant 的 REST API
            async with httpx.AsyncClient(timeout=wait_for_data + 10.0) as client:
                response = await client.get(
                    f"{self._server_url}/sessions/{session_id}/events",
                    params=params,
                )
                
                # 处理 404 错误（会话不存在）
                if response.status_code == 404:
                    self.logger.warning(f"会话不存在: {session_id}")
                    # 返回空列表而不是抛出异常，允许前端处理
                    return []
                
                response.raise_for_status()
                data = response.json()
                
                # 解析返回的数据
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    if "events" in data:
                        return data["events"]
                    elif "items" in data:
                        return data["items"]
                    elif "data" in data:
                        return data["data"] if isinstance(data["data"], list) else [data["data"]]
                    else:
                        return [data]
                else:
                    return []
        except httpx.HTTPStatusError as e:
            # 处理其他 HTTP 错误
            if e.response.status_code == 404:
                self.logger.warning(f"会话不存在: {session_id}")
                return []
            self.logger.error(f"获取事件列表失败 (HTTP {e.response.status_code}): {e}")
            raise RuntimeError(f"获取事件列表失败: HTTP {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            self.logger.error(f"请求 Parlant 服务器失败: {e}")
            raise RuntimeError(f"无法连接到 Parlant 服务器: {str(e)}")
        except Exception as e:
            self.logger.error(f"获取事件列表失败: {e}")
            raise


# 全局服务实例
chat_service = ChatService()

