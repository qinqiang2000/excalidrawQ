#!/bin/bash

# 快速部署脚本 - 使用开发模式（无需构建）
set -e

echo "========================================"
echo "     Excalidraw 开发模式部署"
echo "========================================"
echo

# 如果有参数，作为提交信息
if [ -n "$1" ]; then
    echo "📝 提交代码..."
    git add .
    git commit -m "$1"
fi

echo "📤 推送到远程仓库..."
git push excalidrawQ qiang

echo "🚀 部署到服务器（开发模式）..."
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 '
    cd /root/excalidrawQ
    
    echo "拉取代码..."
    git pull origin qiang
    
    echo "检查依赖变化..."
    if git diff --name-only HEAD@{1} HEAD | grep -q "package.json\|yarn.lock"; then
        echo "安装依赖..."
        yarn install
    else
        echo "跳过依赖安装"
    fi
    
    echo "停止现有服务..."
    systemctl stop excalidraw || true
    
    echo "启动开发模式服务器..."
    # 使用 --port 参数指定端口为 3000
    cd excalidraw-app
    VITE_APP_ENABLE_PWA=true PORT=3000 nohup yarn start > /var/log/excalidraw-dev.log 2>&1 &
    cd ..
    
    # 等待服务启动
    sleep 5
    
    # 检查是否成功启动
    if pgrep -f "vite" > /dev/null; then
        echo "✅ 开发服务器启动成功！"
        echo "端口: 3000 (通过 Caddy 代理)"
    else
        echo "❌ 启动失败，检查日志："
        cat /var/log/excalidraw-dev.log
        exit 1
    fi
'

echo
echo "🎉 部署完成！"
echo "访问地址: https://excalidrawx.duckdns.org"
echo "（注意：使用开发模式，性能可能略差但部署更快）"