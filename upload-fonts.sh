#!/bin/bash

# 字体文件一次性上传脚本
set -e

echo "========================================"
echo "     Excalidraw 字体文件上传脚本"
echo "========================================"

# 检查是否有构建目录
if [ ! -d "excalidraw-app/build" ]; then
    echo "❌ 构建目录不存在，请先运行构建"
    echo "提示: 运行 './deploy-local-build.sh p' 先构建项目"
    exit 1
fi

# 检查字体目录
if [ ! -d "excalidraw-app/build/fonts" ]; then
    echo "❌ 字体目录不存在"
    exit 1
fi

echo "📊 字体文件统计:"
echo "字体目录大小: $(du -sh excalidraw-app/build/fonts/ | cut -f1)"
echo "字体文件数量: $(find excalidraw-app/build/fonts/ -name "*.woff2" | wc -l)"

echo
echo "🚀 开始上传字体文件到服务器..."

# 创建服务器字体目录
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'mkdir -p /root/excalidraw-fonts'

# 上传字体文件
rsync -avz --progress \
    -e "ssh -i ~/tools/pem/ty_sg01.pem" \
    excalidraw-app/build/fonts/ \
    root@129.226.88.226:/root/excalidraw-fonts/

echo
echo "✅ 字体文件上传完成！"
echo
echo "📝 下次部署时使用快速脚本:"
echo "./deploy-fast.sh p \"提交信息\""