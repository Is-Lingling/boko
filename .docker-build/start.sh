#!/bin/bash
set -e

# 预置 ngrok 二进制（如果存在）
if [ -f /opt/boko/ngrok ]; then
    echo "[ngrok] 发现预置 ngrok 二进制，正在安装..."
    cp /opt/boko/ngrok /usr/local/bin/ngrok
    chmod +x /usr/local/bin/ngrok
    echo "[ngrok] 安装完成"
else
    echo "[ngrok] 未找到预置 ngrok，将跳过穿透"
fi

# 设置 ngrok 认证令牌（如果已安装）
if command -v ngrok >/dev/null 2>&1; then
    export NGROK_AUTHTOKEN="${NGROK_AUTHTOKEN}"
    echo "[ngrok] 配置认证令牌"
fi

# 启动后端服务（后台运行）
echo "[ngrok] 启动 boko-backend..."
/opt/boko/boko-backend &
BACKEND_PID=$!

# 等待后端服务就绪
echo "[ngrok] 等待后端服务启动..."
for i in $(seq 1 30); do
    if curl -sf -o /dev/null "http://127.0.0.1:8287/api/profile" 2>/dev/null; then
        echo "[ngrok] 后端服务已就绪（第 ${i} 次尝试）"
        break
    fi
    sleep 1
done

# 如果 ngrok 已安装，启动隧道
if command -v ngrok >/dev/null 2>&1; then
    echo "[ngrok] 启动 ngrok 隧道（http://127.0.0.1:8287）..."
    nohup ngrok http 8287 --log=stdout --log-level=info > /var/log/ngrok.log 2>&1 &
    
    # 等待 ngrok 启动并获取公网 URL
    sleep 3
    echo "[ngrok] 正在获取公网地址..."
    for i in $(seq 1 20); do
        NGROK_URL=$(curl -sf http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
        if [ -n "$NGROK_URL" ]; then
            echo ""
            echo "========================================================"
            echo "  🎉 ngrok 穿透已就绪！"
            echo "  公网访问地址: $NGROK_URL"
            echo "========================================================"
            echo "$NGROK_URL" > /tmp/ngrok_url.txt
            break
        fi
        sleep 2
    done
    
    if [ ! -f /tmp/ngrok_url.txt ]; then
        echo "[ngrok] 警告：无法获取公网地址，请检查 ngrok 日志：/var/log/ngrok.log"
    fi
else
    echo "[ngrok] ngrok 未安装，跳过穿透"
fi

# 保持容器运行：等待后端进程
wait $BACKEND_PID
