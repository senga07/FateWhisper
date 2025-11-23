import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from api.fate import router as supervisor_router
from api.expert import router as expert_router
from api.chat import router as chat_router
from cfg.setting import get_settings
from infrastructure.service_manager import service_manager
from services.chat_service import chat_service
from utils.unified_logger import initialize_logging, get_logger
from utils.fix_json_encoding import fix_parlant_json_encoding

# 修复 JSON 编码问题
fix_parlant_json_encoding()

# 初始化统一日志系统
initialize_logging(
    log_level=20,  # INFO
    log_dir="logs",
    main_log_filename="fate_whisper.log",
    enable_console=True,
    enable_file=True
)

logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化服务
    logger.info("正在初始化服务...")
    success = service_manager.initialize()
    if not success:
        logger.error("服务初始化失败，应用可能无法正常工作")
    else:
        logger.info("服务初始化完成")
    
    # 初始化聊天服务
    # 注意：parlant Server 需要单独运行（通过 parlant_server.py 启动）
    logger.info("正在初始化聊天服务...")
    logger.info("💡 提示：确保 parlant Server 已启动（运行: python parlant_server.py）")
    chat_success = await chat_service.initialize()
    if not chat_success:
        logger.error("聊天服务初始化失败，聊天功能可能无法正常工作")
        logger.error("💡 请先启动 parlant Server: python parlant_server.py")
    else:
        logger.info("聊天服务初始化完成")
    
    yield
    
    # 清理聊天服务
    await chat_service.cleanup()
    
    logger.info("服务清理完成")

app = FastAPI(
    title="Fate Whisper API",
    version="1.0.0",
    lifespan=lifespan
)

# 添加CORS中间件以支持前端跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(supervisor_router)
app.include_router(expert_router)
app.include_router(chat_router)


if __name__ == "__main__":
    uvicorn.run(app, port=get_settings().port, host=get_settings().host)
