#!/bin/bash

# Excalidraw 部署脚本 (支持开发/生产模式)
set -e

# 检查部署模式
PRODUCTION_MODE=false
COMMIT_MESSAGE=""

if [ "$1" = "p" ]; then
    PRODUCTION_MODE=true
    COMMIT_MESSAGE="$2"
    echo "========================================"
    echo "     Excalidraw 生产模式部署"
    echo "========================================"
else
    COMMIT_MESSAGE="$1"
    echo "========================================"
    echo "     Excalidraw 简化开发部署"
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

# 部署函数 - 开发模式
deploy_development() {
    echo "🚀 SSH 到服务器并部署 (开发模式)..."
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
    echo "🎉 开发模式部署完成！"
    echo "访问地址: https://excalidrawx.duckdns.org"
    echo "开发日志: ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'tail -f /var/log/excalidraw-dev.log'"
}

# 部署函数 - 生产模式  
deploy_production() {
    echo "🚀 SSH 到服务器并部署 (生产模式)..."
    ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 << 'EOF'
        # 加载环境
        source ~/.zshrc
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
        nvm use 22
        
        echo "当前 Node.js 版本: $(node --version)"
        
        # 检查系统资源
        echo "检查系统资源..."
        free -h
        df -h /
        
        # 清理系统缓存释放内存
        echo "清理系统缓存以释放内存..."
        sync
        echo 3 > /proc/sys/vm/drop_caches
        echo "缓存清理完成"
        
        # 进入项目目录
        cd /root/excalidrawQ
        
        # 更新代码
        echo "拉取最新代码..."
        git pull origin qiang
        
        # 停止现有服务
        echo "停止现有服务..."
        pkill -f "http-server" || true
        pkill -f "vite" || true  # 确保清理开发服务器
        sleep 2
        
        # 进入应用目录
        cd excalidraw-app
        
        # 确保依赖已安装
        echo "检查并安装依赖..."
        yarn install
        
        # 构建生产版本（极简内存优化模式）
        echo "构建生产版本（极简内存优化模式）..."
        export NODE_OPTIONS="--max-old-space-size=1024"
        export VITE_DISABLE_SOURCEMAP=true
        
        # 设置系统级内存限制
        ulimit -v 2097152  # 限制虚拟内存为 2GB
        
        # 第一次尝试：使用标准配置但极低内存限制
        timeout 900 yarn build:app:docker || {
            echo "❌ 标准构建失败，使用极简配置重试..."
            
            # 强制垃圾回收和内存清理
            sync && echo 3 > /proc/sys/vm/drop_caches
            sleep 5
            
            # 第二次尝试：使用极简配置
            export NODE_OPTIONS="--max-old-space-size=768"
            timeout 900 npx vite build --config vite.config.minimal.mts || {
                echo "❌ 极简配置也失败，尝试最后的降级方案..."
                
                # 最后尝试：完全禁用并行处理
                sync && echo 3 > /proc/sys/vm/drop_caches
                export NODE_OPTIONS="--max-old-space-size=512"
                export VITE_BUILD_PARALLEL=false
                
                timeout 1200 npx vite build --config vite.config.minimal.mts || {
                    echo "❌ 所有构建方案都失败了"
                    echo "建议：1. 升级服务器内存到8GB，或 2. 使用本地构建方案"
                    exit 1
                }
            }
        }
        
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
        else
            echo "❌ 启动失败！"
            echo "错误日志："
            cat /var/log/excalidraw-prod.log
            exit 1
        fi
EOF
    
    echo
    echo "🎉 生产模式部署完成！"
    echo "访问地址: https://excalidrawx.duckdns.org"
    echo "生产日志: ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'tail -f /var/log/excalidraw-prod.log'"
}

# 根据模式选择部署方式
if [ "$PRODUCTION_MODE" = true ]; then
    deploy_production
else
    deploy_development
fi