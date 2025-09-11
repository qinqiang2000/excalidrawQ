#!/bin/bash

# 快速部署脚本 - 优化版
set -e

echo "========================================"
echo "     Excalidraw 快速部署脚本"
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

echo "🚀 部署到服务器..."
ssh -i ~/tools/pem/ty_sg01.pem root@43.134.26.236 '
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
    
    echo "构建项目..."
    yarn build
    
    echo "重启服务..."
    systemctl restart excalidraw
    
    echo "✅ 部署完成！"
'

echo
echo "🎉 访问地址: https://excalidrawx.duckdns.org"