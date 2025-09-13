#!/bin/bash

# Excalidraw 存储后端部署脚本 (Node.js 版本)
set -e

echo "========================================"
echo "     Excalidraw 存储后端设置"
echo "========================================"

echo "🚀 在服务器上设置 Excalidraw 存储后端..."

ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 << 'EOF'
    # 加载环境
    source ~/.zshrc
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
    nvm use 22

    echo "当前 Node.js 版本: $(node --version)"

    echo "📁 创建必要目录..."
    mkdir -p /root/excalidraw-backend
    mkdir -p /root/excalidraw-data

    echo "⬇️ 克隆存储后端..."
    cd /root/excalidraw-backend

    # 如果目录已存在，先备份
    if [ -d "excalidraw-storage-backend" ]; then
        echo "备份现有版本..."
        mv excalidraw-storage-backend excalidraw-storage-backend.backup.$(date +%Y%m%d_%H%M%S)
    fi

    # 克隆 Node.js 版本的存储后端
    git clone https://github.com/alswl/excalidraw-storage-backend.git
    cd excalidraw-storage-backend

    echo "📦 安装依赖..."
    npm install

    echo "📝 创建配置文件..."
    cat > .env << 'ENVFILE'
PORT=3002
# 使用内存存储 (简单起见，生产环境可使用 Redis)
KEYV_URI=memory://
CORS_ORIGIN=https://excalidrawx.duckdns.org
ENVFILE

    echo "📝 创建 systemd 服务..."
    cat > /etc/systemd/system/excalidraw-backend.service << 'SERVICE'
[Unit]
Description=Excalidraw Storage Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/excalidraw-backend/excalidraw-storage-backend
Environment=NODE_ENV=production
ExecStart=/root/.nvm/versions/node/v22.9.0/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

    echo "🔄 启用并启动服务..."
    systemctl daemon-reload
    systemctl enable excalidraw-backend

    # 停止现有服务（如果正在运行）
    systemctl stop excalidraw-backend 2>/dev/null || true
    sleep 2

    # 启动服务
    systemctl start excalidraw-backend

    echo "⏳ 等待服务启动..."
    sleep 5

    echo "✅ 检查服务状态..."
    if systemctl is-active excalidraw-backend > /dev/null 2>&1; then
        echo "✅ Excalidraw Complete 后端启动成功！"
        echo "📊 服务状态："
        systemctl status excalidraw-backend --no-pager -l

        echo "🔍 检查端口监听..."
        netstat -tuln | grep 3002 && echo "✅ 端口 3002 正在监听" || echo "⚠️ 端口 3002 未监听"

        echo "💾 检查存储目录："
        ls -la /root/excalidraw-data/

    else
        echo "❌ 服务启动失败！"
        echo "📄 查看错误日志："
        journalctl -u excalidraw-backend --no-pager -l --since="5 minutes ago"
        exit 1
    fi
EOF

echo
echo "🎉 Excalidraw Complete 后端设置完成！"
echo
echo "💡 后续操作："
echo "1. 更新 Caddy 配置: ./update-caddy.sh"
echo "2. 重新部署前端: ./deploy-prod.sh p \"add sharing support\""
echo
echo "🔍 管理命令："
echo "- 查看状态: ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'systemctl status excalidraw-backend'"
echo "- 查看日志: ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'journalctl -u excalidraw-backend -f'"
echo "- 重启服务: ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'systemctl restart excalidraw-backend'"
echo