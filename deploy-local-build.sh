#!/bin/bash

# Excalidraw 本地构建部署脚本 (解决服务器内存不足问题)
set -e

# 检查部署模式
PRODUCTION_MODE=false
COMMIT_MESSAGE=""

if [ "$1" = "p" ]; then
    PRODUCTION_MODE=true
    COMMIT_MESSAGE="$2"
    echo "========================================"
    echo "     Excalidraw 本地构建生产部署"
    echo "========================================"
else
    COMMIT_MESSAGE="$1"
    echo "========================================"
    echo "     Excalidraw 本地构建开发部署"
    echo "========================================"
fi

# 如果有提交信息，提交代码
if [ -n "$COMMIT_MESSAGE" ]; then
    echo "📝 提交代码..."
    git add .
    git commit -m "$COMMIT_MESSAGE"
fi

echo "📤 推送到远程仓库..."
git push excalidrawQ qiang

# 本地构建函数
local_build() {
    echo "🏗️ 开始本地构建..."
    
    # 进入应用目录
    cd excalidraw-app
    
    # 确保依赖已安装
    echo "检查并安装依赖..."
    yarn install
    
    # 构建生产版本
    echo "构建生产版本..."
    if [ "$PRODUCTION_MODE" = true ]; then
        # 生产模式：使用优化配置
        export VITE_APP_DISABLE_SENTRY=true
        yarn build:app:docker
    else
        # 开发模式：使用标准配置
        yarn build
    fi
    
    echo "✅ 本地构建完成！"
    
    # 返回根目录
    cd ..
}

# 上传并部署函数
deploy_to_server() {
    echo "🚀 上传构建文件到服务器..."
    
    # 使用 rsync 高效上传 build 目录
    rsync -avz --progress --delete \
        -e "ssh -i ~/tools/pem/ty_sg01.pem" \
        excalidraw-app/build/ \
        root@129.226.88.226:/root/excalidraw-build/
    
    echo "📡 SSH 到服务器并启动服务..."
    ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 << 'EOF'
        # 加载环境
        source ~/.zshrc
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
        nvm use 22
        
        echo "当前 Node.js 版本: $(node --version)"
        
        # 进入项目目录并更新代码
        cd /root/excalidrawQ
        git pull excalidrawQ qiang
        
        # 停止现有服务
        echo "停止现有服务..."
        pkill -f "http-server" || true
        pkill -f "vite" || true
        sleep 2
        
        # 创建构建目录链接（如果不存在）
        if [ ! -L "/root/excalidrawQ/excalidraw-app/build" ]; then
            rm -rf /root/excalidrawQ/excalidraw-app/build
            ln -s /root/excalidraw-build /root/excalidrawQ/excalidraw-app/build
        fi
        
        # 进入应用目录
        cd /root/excalidrawQ/excalidraw-app
        
        # 启动静态文件服务器
        echo "启动生产服务器..."
        nohup npx http-server build -a 0.0.0.0 -p 3000 --cors -c-1 > /var/log/excalidraw-prod.log 2>&1 &
        
        # 等待启动
        sleep 5
        
        # 检查状态
        if pgrep -f "http-server" > /dev/null; then
            echo "✅ 生产服务器启动成功！"
            echo "检查端口监听..."
            netstat -tuln | grep 3000 && echo "端口 3000 正在监听" || echo "端口 3000 未监听，但进程运行中"
            
            echo "服务器内存状态："
            free -h
        else
            echo "❌ 启动失败！"
            echo "错误日志："
            cat /var/log/excalidraw-prod.log
            exit 1
        fi
EOF
    
    echo
    if [ "$PRODUCTION_MODE" = true ]; then
        echo "🎉 本地构建生产模式部署完成！"
    else
        echo "🎉 本地构建开发模式部署完成！"
    fi
    echo "访问地址: https://excalidrawx.duckdns.org"
    echo "服务器日志: ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'tail -f /var/log/excalidraw-prod.log'"
}

# 执行部署流程
echo "🔍 检查构建环境..."
if ! command -v yarn &> /dev/null; then
    echo "❌ yarn 未安装，请先安装 yarn"
    exit 1
fi

if ! command -v rsync &> /dev/null; then
    echo "❌ rsync 未安装，请先安装 rsync"
    exit 1
fi

# 执行本地构建
local_build

# 上传并部署
deploy_to_server

echo "🎯 部署完成！现在可以访问应用了。"