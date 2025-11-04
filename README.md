# Fate Whisper - 智能命理分析系统

<div align="center">

![Fate Whisper](images/index.png)

**基于 AI 的多专家命理分析平台**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.117+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2+-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178c6.svg)](https://www.typescriptlang.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.6+-orange.svg)](https://langchain-ai.github.io/langgraph/)

</div>

## 📖 项目简介

Fate Whisper 是一个基于 AI 的智能命理分析系统，通过集成多个命理专家（八字、手相、面相），为用户提供全面的命理分析服务。系统采用 LangGraph 构建并行专家分析工作流，支持流式输出实时展示分析结果。

### ✨ 核心特性

- 🔮 **多专家并行分析**：支持同时选择多个命理专家进行综合分析
- 📊 **流式实时展示**：采用 Server-Sent Events (SSE) 实现分析结果的实时流式传输
- 🎨 **现代化 UI**：基于 React + TypeScript 构建的响应式用户界面
- 🔧 **灵活专家管理**：支持动态添加、编辑、删除命理专家
- 🖼️ **图片识别分析**：支持上传手相、面相照片进行 AI 分析
- 🔒 **隐私保护**：承诺不获取或存储用户个人信息

## 🏗️ 技术架构

### 后端技术栈

- **框架**: FastAPI
- **工作流引擎**: LangGraph
- **LLM 框架**: LangChain
- **AI 服务**: Azure OpenAI / 阿里云百炼 (DashScope)
- **状态管理**: LangGraph MemorySaver
- **日志系统**: 统一日志管理

### 前端技术栈

- **框架**: React 18.2
- **语言**: TypeScript 5.3
- **构建工具**: Vite 5.0
- **路由**: React Router 6.20
- **HTTP 客户端**: Axios
- **Markdown 渲染**: Marked

## 📁 项目结构

```
FateWhisper/
├── fw-backend/              # 后端服务
│   ├── api/                 # API 路由
│   │   ├── fate.py          # 命理分析 API
│   │   └── expert.py        # 专家管理 API
│   ├── graph/               # LangGraph 工作流
│   │   └── fate_graph.py    # 命理分析图定义
│   ├── cfg/                 # 配置文件
│   │   ├── experts.json     # 专家配置
│   │   └── setting.py       # 应用设置
│   ├── services/            # 服务层
│   │   └── service_manager.py
│   ├── tools/               # 工具函数
│   │   └── bazi_tools.py    # 八字工具
│   ├── utils/               # 工具类
│   │   ├── unified_logger.py
│   │   └── custom_serializer.py
│   ├── llm_provider/        # LLM 提供者
│   ├── memory/              # 记忆管理
│   └── main.py              # 应用入口
│
├── fw-frontend/             # 前端应用
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   │   ├── ExpertSelector.tsx  # 专家选择页
│   │   │   ├── Analysis.tsx         # 分析结果页
│   │   │   ├── ExpertManage.tsx     # 专家管理页
│   │   │   └── ExpertEdit.tsx       # 专家编辑页
│   │   ├── services/        # API 服务
│   │   │   └── api.ts
│   │   ├── types/           # TypeScript 类型定义
│   │   └── App.tsx          # 应用入口
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## 🚀 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+
- npm 或 yarn

### 后端部署

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd FateWhisper
   ```

2. **进入后端目录**
   ```bash
   cd fw-backend
   ```

3. **安装依赖**
   ```bash
   pip install -e .
   # 或使用 uv
   uv pip install -e .
   ```

4. **配置环境变量**
   ```bash
   cp sample.env .env
   ```
   
   编辑 `.env` 文件，配置以下参数：
   ```env
   # Azure OpenAI 配置
   AZURE_OPENAI_API_KEY=your_api_key
   AZURE_OPENAI_ENDPOINT=your_endpoint
   AZURE_OPENAI_API_VERSION=2024-02-15-preview
   
   # 阿里云百炼配置
   DASHSCOPE_API_KEY=your_api_key
   
   # LLM 模型配置
   FAST_LLM=azure_openai/gpt-4o
   VISION_LLM=azure_openai/gpt-4o
   
   # 服务器配置
   HOST=0.0.0.0
   PORT=8001
   
   # Embedding 配置
   EMBEDDING=dashscope/text-embedding-v2
   ```

5. **启动后端服务**
   ```bash
   python main.py
   # 或使用 uvicorn
   uvicorn main:app --host 0.0.0.0 --port 8001
   ```

   后端服务将在 `http://localhost:8001` 启动

### 前端部署

1. **进入前端目录**
   ```bash
   cd fw-frontend
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置 API 地址**
   
   编辑 `src/services/api.ts`，修改 `API_BASE` 为后端地址：
   ```typescript
   const API_BASE = 'http://localhost:8001';
   ```

4. **启动开发服务器**
   ```bash
   npm run dev:client
   ```

   前端应用将在 `http://localhost:5173` 启动

5. **构建生产版本**
   ```bash
   npm run build
   ```

## 📖 使用指南

### 1. 选择专家

访问首页，选择一个或多个命理专家：
- **八字专家**：需要提供出生日期
- **手相专家**：需要上传左右手照片
- **面相专家**：需要上传面部正脸照片

### 2. 填写信息

根据所选专家的要求，填写或上传相应的信息：
- 文本字段：直接输入
- 日期字段：选择日期
- 图片字段：上传图片文件

### 3. 开始分析

点击"开始分析"按钮，系统将：
1. 并行调用所选专家进行分析
2. 实时流式返回各专家的分析结果
3. 最后生成综合分析报告

### 4. 查看结果

分析结果页面会显示：
- 各专家的独立分析报告（以标签页形式展示）
- 综合分析报告（包含所有专家的整合分析）
- Markdown 格式渲染，支持复制功能

### 5. 专家管理

管理员可以：
- 查看所有专家列表
- 添加新专家（配置名称、技能、提示词、图标、必填字段等）
- 编辑现有专家信息
- 删除专家

## 🔧 专家配置

专家配置存储在 `fw-backend/cfg/experts.json` 中，每个专家包含以下字段：

```json
{
  "id": "unique-id",
  "name": "专家名称",
  "skills": "专家技能描述",
  "prompt": "专家提示词（系统提示）",
  "icon": "🔮",
  "required_fields": [
    {
      "field_name": "字段名称",
      "field_type": "text|datetime|image",
      "field_id": "field_id"
    }
  ]
}
```

### 字段类型

- **text**: 文本输入
- **datetime**: 日期时间选择
- **image**: 图片上传

## 🎯 核心功能

### 并行专家分析

系统使用 LangGraph 构建并行分析工作流：

1. **状态定义**：使用 `TypedDict` 定义图状态
2. **并行节点**：每个专家作为独立节点并行执行
3. **状态合并**：使用 `Annotated` 和自定义合并函数处理并行更新
4. **流式输出**：通过 SSE 实时推送分析结果

### 流式处理

- 支持 Server-Sent Events (SSE) 流式传输
- 实时展示各专家的分析进度
- 前端自动解析多个数据块
- 支持 Markdown 格式渲染

### 图片分析

- 支持上传手相、面相照片
- 使用 Vision LLM 进行图片识别和分析
- 自动转换为 base64 格式传递给 AI 模型

## 🔒 隐私保护

系统承诺：
- ✅ 不获取或存储用户个人信息
- ✅ 所有数据仅用于本次分析
- ✅ 分析完成后不保留用户数据

## 📝 API 文档

启动后端服务后，访问以下地址查看 API 文档：

- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

### 主要 API 端点

#### 命理分析
- `POST /api/fortune/analyze` - 执行命理分析（流式返回）

#### 专家管理
- `GET /api/expert/list` - 获取专家列表
- `POST /api/expert/create` - 创建专家
- `PUT /api/expert/{expert_id}` - 更新专家
- `DELETE /api/expert/{expert_id}` - 删除专家

## 🛠️ 开发指南

### 后端开发

1. **添加新专家类型**
   - 在 `cfg/experts.json` 中添加专家配置
   - 配置相应的提示词和必填字段

2. **自定义分析逻辑**
   - 修改 `graph/fate_graph.py` 中的节点函数
   - 调整 `_process_result` 方法处理结果

3. **添加工具函数**
   - 在 `tools/` 目录下添加新工具
   - 在专家提示词中引用工具

### 前端开发

1. **添加新页面**
   - 在 `src/pages/` 下创建新组件
   - 在 `App.tsx` 中添加路由

2. **修改 API 调用**
   - 在 `src/services/api.ts` 中添加新的 API 方法

3. **样式调整**
   - 各页面有对应的 CSS 文件
   - 使用 CSS 变量统一管理主题色

## 📄 许可证

MIT License

## 👤 作者

senga07

## 🙏 致谢

- [LangChain](https://www.langchain.com/) - LLM 应用开发框架
- [LangGraph](https://langchain-ai.github.io/langgraph/) - 状态机工作流引擎
- [FastAPI](https://fastapi.tiangolo.com/) - 现代 Python Web 框架
- [React](https://reactjs.org/) - UI 框架

---

<div align="center">

**Fate Whisper** - 让 AI 为您解读命运 ✨

</div>

