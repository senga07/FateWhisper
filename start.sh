#!/bin/bash

# Fate Whisper 启动脚本
# 同时启动前端、FastAPI 后端和 Parlant 服务器

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# PID 文件目录
PID_DIR="$SCRIPT_DIR/.pids"
mkdir -p "$PID_DIR"

# 日志文件目录
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}正在关闭所有服务...${NC}"
    
    # 读取并杀死所有保存的进程
    if [ -d "$PID_DIR" ]; then
        for pidfile in "$PID_DIR"/*.pid; do
            if [ -f "$pidfile" ]; then
                PID=$(cat "$pidfile")
                if ps -p "$PID" > /dev/null 2>&1; then
                    echo -e "${YELLOW}正在关闭进程 $PID...${NC}"
                    kill "$PID" 2>/dev/null || true
                fi
                rm -f "$pidfile"
            fi
        done
    fi
    
    # 等待进程结束
    sleep 2
    
    # 强制杀死残留进程
    pkill -f "uvicorn.*main:app" 2>/dev/null || true
    pkill -f "parlant_server.py" 2>/dev/null || true
    pkill -f "node.*server.js" 2>/dev/null || true
    
    echo -e "${GREEN}所有服务已关闭${NC}"
    exit 0
}

# 注册清理函数
trap cleanup SIGINT SIGTERM

# 检查依赖
echo -e "${BLUE}检查依赖...${NC}"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}错误: 未找到 python3${NC}"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到 node${NC}"
    exit 1
fi

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未找到 npm${NC}"
    exit 1
fi

echo -e "${GREEN}依赖检查通过${NC}\n"

# 启动 Parlant 服务器
echo -e "${BLUE}启动 Parlant 服务器...${NC}"
cd "$SCRIPT_DIR/fw-backend"
python3 parlant_server.py > "$LOG_DIR/parlant.log" 2>&1 &
PARLANT_PID=$!
echo $PARLANT_PID > "$PID_DIR/parlant.pid"
echo -e "${GREEN}✓ Parlant 服务器已启动 (PID: $PARLANT_PID)${NC}"
echo -e "  日志文件: $LOG_DIR/parlant.log\n"

# 等待 Parlant 服务器启动
sleep 3

# 启动 FastAPI 后端
echo -e "${BLUE}启动 FastAPI 后端...${NC}"
cd "$SCRIPT_DIR/fw-backend"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8080 > "$LOG_DIR/fastapi.log" 2>&1 &
FASTAPI_PID=$!
echo $FASTAPI_PID > "$PID_DIR/fastapi.pid"
echo -e "${GREEN}✓ FastAPI 后端已启动 (PID: $FASTAPI_PID)${NC}"
echo -e "  日志文件: $LOG_DIR/fastapi.log\n"

# 等待 FastAPI 启动
sleep 2

# 检查前端依赖
echo -e "${BLUE}检查前端依赖...${NC}"
cd "$SCRIPT_DIR/fw-frontend"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}未找到 node_modules，正在安装依赖...${NC}"
    npm install
fi

# 启动前端服务器
echo -e "${BLUE}启动前端服务器...${NC}"
cd "$SCRIPT_DIR/fw-frontend"
npm start > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$PID_DIR/frontend.pid"
echo -e "${GREEN}✓ 前端服务器已启动 (PID: $FRONTEND_PID)${NC}"
echo -e "  日志文件: $LOG_DIR/frontend.log\n"

# 等待服务启动
sleep 3

# 显示启动信息
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  所有服务已启动成功！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}前端服务:${NC}    http://localhost:3000"
echo -e "${BLUE}FastAPI:${NC}     http://localhost:8080"
echo -e "${BLUE}Parlant:${NC}      http://localhost:8800"
echo -e "\n${YELLOW}日志文件位置:${NC}"
echo -e "  - Parlant:  $LOG_DIR/parlant.log"
echo -e "  - FastAPI:  $LOG_DIR/fastapi.log"
echo -e "  - Frontend: $LOG_DIR/frontend.log"
echo -e "\n${YELLOW}按 Ctrl+C 停止所有服务${NC}\n"

# 等待所有后台进程
wait

