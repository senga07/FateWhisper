#!/bin/bash

# Fate Whisper 停止脚本
# 停止所有运行中的服务

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_DIR="$SCRIPT_DIR/.pids"

echo -e "${YELLOW}正在停止所有服务...${NC}"

# 读取并杀死所有保存的进程
if [ -d "$PID_DIR" ]; then
    for pidfile in "$PID_DIR"/*.pid; do
        if [ -f "$pidfile" ]; then
            PID=$(cat "$pidfile")
            SERVICE_NAME=$(basename "$pidfile" .pid)
            if ps -p "$PID" > /dev/null 2>&1; then
                echo -e "${BLUE}正在停止 $SERVICE_NAME (PID: $PID)...${NC}"
                kill "$PID" 2>/dev/null || true
                echo -e "${GREEN}✓ $SERVICE_NAME 已停止${NC}"
            else
                echo -e "${YELLOW}进程 $PID ($SERVICE_NAME) 已不存在${NC}"
            fi
            rm -f "$pidfile"
        fi
    done
else
    echo -e "${YELLOW}未找到 PID 目录，尝试直接查找进程...${NC}"
fi

# 等待进程结束
sleep 2

# 强制杀死残留进程
echo -e "${YELLOW}清理残留进程...${NC}"
pkill -f "uvicorn.*main:app" 2>/dev/null && echo -e "${GREEN}✓ FastAPI 进程已清理${NC}" || true
pkill -f "parlant_server.py" 2>/dev/null && echo -e "${GREEN}✓ Parlant 进程已清理${NC}" || true
pkill -f "node.*server.js" 2>/dev/null && echo -e "${GREEN}✓ 前端进程已清理${NC}" || true

# 清理 PID 目录
if [ -d "$PID_DIR" ]; then
    rm -rf "$PID_DIR"
fi

echo -e "\n${GREEN}所有服务已停止${NC}"

