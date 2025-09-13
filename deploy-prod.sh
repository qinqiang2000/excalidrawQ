#!/bin/bash

# Excalidraw 快速代码部署脚本 (不含字体文件)
set -e

# 检查部署模式
PRODUCTION_MODE=false
COMMIT_MESSAGE=""

if [ "$1" = "p" ]; then
    PRODUCTION_MODE=true
    COMMIT_MESSAGE="$2"
    echo "========================================"
    echo "     Excalidraw 快速生产部署"
    echo "========================================"
else
    COMMIT_MESSAGE="$1"
    echo "========================================"
    echo "     Excalidraw 快速开发部署"
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
        export VITE_APP_DISABLE_SENTRY=true
        yarn build:app:docker
    else
        yarn build
    fi
    
    echo "✅ 本地构建完成！"
    
    # 返回根目录
    cd ..
}

# 快速上传代码文件 (排除字体)
upload_code_only() {
    echo "🚀 上传代码文件到服务器 (排除字体)..."
    
    # 创建临时目录，复制除字体外的所有文件
    mkdir -p /tmp/excalidraw-deploy
    rsync -av --exclude='fonts/' excalidraw-app/build/ /tmp/excalidraw-deploy/
    
    # 显示上传文件大小
    echo "代码文件大小: $(du -sh /tmp/excalidraw-deploy | cut -f1)"
    
    # 使用 tar 压缩上传
    echo "📦 压缩并上传..."
    cd /tmp/excalidraw-deploy
    tar -czf /tmp/excalidraw-code.tar.gz .
    echo "压缩包大小: $(du -sh /tmp/excalidraw-code.tar.gz | cut -f1)"
    
    # 上传压缩包
    scp -i ~/tools/pem/ty_sg01.pem /tmp/excalidraw-code.tar.gz root@129.226.88.226:/tmp/
    
    # 清理本地临时文件
    rm -rf /tmp/excalidraw-deploy /tmp/excalidraw-code.tar.gz
    
    echo "✅ 代码文件上传完成！"
}

# 服务器部署
deploy_on_server() {
    echo "📡 SSH 到服务器并部署..."
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

        # 检查并启动后端服务
        echo "检查分享功能后端服务..."
        if ! systemctl is-active excalidraw-backend > /dev/null 2>&1; then
            echo "启动 Excalidraw Complete 后端..."
            systemctl start excalidraw-backend
            sleep 3
        else
            echo "✅ 后端服务已运行"
        fi
        
        # 创建部署目录
        mkdir -p /var/www/excalidraw

        # 解压新的代码文件
        echo "解压新代码文件..."
        cd /var/www/excalidraw
        tar -xzf /tmp/excalidraw-code.tar.gz

        # 设置正确的权限
        chown -R caddy:caddy /var/www/excalidraw

        # 创建字体目录链接 (如果不存在)
        if [ ! -L "fonts" ] && [ -d "/root/excalidraw-fonts" ]; then
            ln -s /root/excalidraw-fonts fonts
            echo "✅ 创建字体目录链接"
        fi
        
        # 进入应用目录并创建构建目录链接
        cd /root/excalidrawQ/excalidraw-app
        if [ ! -L "build" ]; then
            rm -rf build
            ln -s /var/www/excalidraw build
            echo "✅ 创建构建目录链接"
        fi
        
        # 启动生产服务器
        echo "启动生产服务器..."
        nohup npx http-server build -a 0.0.0.0 -p 3000 --cors -c-1 > /var/log/excalidraw-prod.log 2>&1 &
        
        # 等待启动
        sleep 5
        
        # 检查服务状态
        echo "🔍 检查所有服务状态..."
        FRONTEND_OK=false
        BACKEND_OK=false

        # 检查前端服务
        if pgrep -f "http-server" > /dev/null; then
            echo "✅ 前端服务器启动成功！"
            netstat -tuln | grep 3000 && echo "✅ 端口 3000 正在监听" || echo "⚠️ 端口 3000 未监听"
            FRONTEND_OK=true
        else
            echo "❌ 前端服务启动失败！"
            echo "错误日志："
            tail -20 /var/log/excalidraw-prod.log
        fi

        # 检查后端服务
        if systemctl is-active excalidraw-backend > /dev/null 2>&1; then
            echo "✅ 后端服务运行正常！"
            netstat -tuln | grep 3002 && echo "✅ 端口 3002 正在监听" || echo "⚠️ 端口 3002 未监听"
            BACKEND_OK=true
        else
            echo "❌ 后端服务未运行！"
            systemctl status excalidraw-backend --no-pager -l
        fi

        # 显示系统状态
        echo "📊 服务器状态："
        free -h

        # 清理临时文件
        rm -f /tmp/excalidraw-code.tar.gz

        # 检查总体状态
        if [ "$FRONTEND_OK" = true ] && [ "$BACKEND_OK" = true ]; then
            echo "🎉 所有服务启动成功！"
            echo "🌐 访问地址: https://excalidrawx.duckdns.org"
            echo "🔗 分享功能已启用"
        elif [ "$FRONTEND_OK" = true ]; then
            echo "⚠️ 前端正常，但后端服务异常（分享功能可能不可用）"
            exit 1
        else
            echo "❌ 部署失败！"
            exit 1
        fi
EOF
}

# 执行部署流程
echo "🔍 检查构建环境..."
if ! command -v yarn &> /dev/null; then
    echo "❌ yarn 未安装，请先安装 yarn"
    exit 1
fi

# 执行本地构建
local_build

# 上传代码文件
upload_code_only

# 服务器部署
deploy_on_server

echo
if [ "$PRODUCTION_MODE" = true ]; then
    echo "🎉 快速生产部署完成！"
else
    echo "🎉 快速开发部署完成！"
fi
echo "访问地址: https://excalidrawx.duckdns.org"
echo "服务器日志: ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'tail -f /var/log/excalidraw-prod.log'"
echo
echo "💡 提示:"
echo "- 首次部署需要运行: ./upload-fonts.sh"
echo "- 日常部署使用: ./deploy-prod.sh p \"提交信息\""