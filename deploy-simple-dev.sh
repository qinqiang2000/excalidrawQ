#!/bin/bash

# 简化的开发部署脚本
set -e

echo "========================================"
echo "     Excalidraw 简化开发部署"
echo "========================================"

# 如果有参数，作为提交信息
if [ -n "$1" ]; then
    echo "📝 提交代码..."
    git add .
    git commit -m "$1"
fi

echo "📤 推送到远程仓库..."
git push excalidrawQ qiang

echo "🚀 SSH 到服务器并部署..."
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 << 'EOF'
    # 加载环境
    source ~/.zshrc
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
    nvm use 22
    
    echo "当前 Node.js 版本: $(node --version)"
    
    # 进入项目目录
    cd /root/excalidrawQ
    
    # 更新代码
    echo "拉取最新代码..."
    git pull origin qiang
    
    # 停止现有服务
    echo "停止现有服务..."
    pkill -f "vite" || true
    sleep 2
    
    # 进入应用目录
    cd excalidraw-app
    
    # 确保依赖已安装
    echo "检查并安装依赖..."
    yarn install
    
    # 启动开发服务器
    echo "启动开发服务器..."
    VITE_APP_ENABLE_PWA=true PORT=3000 nohup yarn start --host 0.0.0.0 > /var/log/excalidraw-dev.log 2>&1 &
    
    # 等待启动
    sleep 10
    
    # 检查状态
    if pgrep -f "vite" > /dev/null; then
        echo "✅ 开发服务器启动成功！"
        echo "检查端口监听..."
        netstat -tuln | grep 3000 && echo "端口 3000 正在监听" || echo "端口 3000 未监听，但进程运行中"
    else
        echo "❌ 启动失败！"
        echo "错误日志："
        cat /var/log/excalidraw-dev.log
        exit 1
    fi
EOF

echo
echo "🎉 部署完成！"
echo "访问地址: https://excalidrawx.duckdns.org"
echo "开发日志: ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'tail -f /var/log/excalidraw-dev.log'"