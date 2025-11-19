"""
服务管理器

提供基本的服务管理功能，避免循环依赖
"""

from langgraph.store.base import IndexConfig
from langgraph.store.memory import InMemoryStore

from cfg.setting import get_settings
from llm_provider.base import get_llm, _SUPPORTED_PROVIDERS
from memory.embeddings import Embeddings
from utils.unified_logger import get_logger


class ServiceManager:
    """服务管理器 - 单例模式"""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.logger = get_logger(__name__)
            self.settings = None
            self.fast_llm = None
            self.vision_llm = None
            self._initialized = True
            self.store = None

    @staticmethod
    def parse_llm(llm_str: str | None) -> tuple[str | None, str | None]:
        """Parse llm string into (llm_provider, llm_model)."""
        if llm_str is None:
            return None, None
        try:
            llm_provider, llm_model = llm_str.split(":", 1)
            assert llm_provider in _SUPPORTED_PROVIDERS, (
                    f"Unsupported {llm_provider}.\nSupported llm providers are: "
                    + ", ".join(_SUPPORTED_PROVIDERS)
            )
            return llm_provider, llm_model
        except ValueError:
            raise ValueError(
                "Set SMART_LLM or FAST_LLM = '<llm_provider>:<llm_model>' "
                "Eg 'azure_openai:gpt-4o-mini'"
            )

    
    def initialize(self) -> bool:
        """初始化基本服务"""
        try:
            self.logger.info("开始初始化服务管理器...")

            self.settings = get_settings()
            self._initialize_llms()

            embedding_provider, embedding_model = self.parse_llm(self.settings.embedding)
            embedding = Embeddings(embedding_provider, embedding_model).get_embeddings()
            self.store = InMemoryStore(index=IndexConfig(dims=1024,embed = embedding))
            self.logger.info("服务管理器初始化完成")
            return True
        except Exception as e:
            self.logger.error(f"服务初始化失败: {e}")
            return False
    
    def _initialize_llms(self):
        """初始化LLM实例"""
        try:
            # 解析fast_llm配置
            fast_llm_provider, fast_llm_model = self.parse_llm(self.settings.fast_llm)
            self.fast_llm = get_llm(
                llm_provider=fast_llm_provider,
                model=fast_llm_model,
                **{}
            ).llm
            
            # 解析vision_llm配置
            vision_llm_provider, vision_llm_model = self.parse_llm(self.settings.vision_llm)
            self.vision_llm = get_llm(
                llm_provider=vision_llm_provider,
                model=vision_llm_model,
                **{}
            ).llm
            self.logger.info("LLM实例初始化完成")
        except Exception as e:
            self.logger.error(f"LLM初始化失败: {e}")
            raise
    
    def get_llms(self):
        """获取所有LLM实例"""
        return {
            'fast_llm': self.fast_llm,
            'vision_llm': self.vision_llm
        }
    
    def get_config(self):
        """获取配置实例"""
        return self.settings


# 全局服务管理器实例
service_manager = ServiceManager()

