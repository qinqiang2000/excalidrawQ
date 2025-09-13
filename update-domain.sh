#!/bin/bash

# 域名快速更换脚本
set -e

NEW_DOMAIN=$1

if [ -z "$NEW_DOMAIN" ]; then
    echo "❌ 用法: ./update-domain.sh new-domain.com"
    echo
    echo "示例:"
    echo "  ./update-domain.sh excalidraw.example.com"
    echo "  ./update-domain.sh my-draw.duckdns.org"
    exit 1
fi

echo "========================================"
echo "       域名更换: $NEW_DOMAIN"
echo "========================================"

# 检查 .env.local 文件是否存在
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local 文件不存在！"
    echo "请先运行分享功能设置。"
    exit 1
fi

echo "📝 更新本地环境变量..."

# 更新本地 .env.local 文件
sed -i "" "s/VITE_APP_BASE_DOMAIN=.*/VITE_APP_BASE_DOMAIN=$NEW_DOMAIN/" .env.local

# 更新所有相关的 URL
sed -i "" "s|https://[^/]*/storage-backend/|https://$NEW_DOMAIN/storage-backend/|g" .env.local
sed -i "" "s|wss://[^/]*/socket|wss://$NEW_DOMAIN/socket|g" .env.local

echo "✅ 本地配置已更新"

echo "🔧 更新服务器配置..."

# 更新远程服务器的 Caddy 配置
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 << EOF
    echo "💾 备份 Caddy 配置..."
    cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup.\$(date +%Y%m%d_%H%M%S)

    echo "📝 更新域名配置..."
    # 替换域名（保留所有其他配置）
    sed -i "s/^[a-zA-Z0-9.-]* {/$NEW_DOMAIN {/" /etc/caddy/Caddyfile

    # 更新 CORS 头部中的域名
    sed -i "s|Access-Control-Allow-Origin \"https://[^\"]*\"|Access-Control-Allow-Origin \"https://$NEW_DOMAIN\"|" /etc/caddy/Caddyfile

    echo "🔍 验证 Caddy 配置..."
    if caddy validate --config /etc/caddy/Caddyfile; then
        echo "✅ 配置验证通过"

        echo "🔄 重载 Caddy 配置..."
        caddy reload --config /etc/caddy/Caddyfile

        echo "✅ 服务器配置更新完成"
    else
        echo "❌ 配置验证失败！"
        echo "🔙 恢复备份配置..."
        cp /etc/caddy/Caddyfile.backup.\$(date +%Y%m%d)_* /etc/caddy/Caddyfile
        caddy reload --config /etc/caddy/Caddyfile
        exit 1
    fi
EOF

echo
echo "🎉 域名更换完成！"
echo
echo "📋 变更摘要:"
echo "- 旧域名: $(grep 'excalidrawx.duckdns.org' .env.local.backup 2>/dev/null || echo '未知')"
echo "- 新域名: $NEW_DOMAIN"
echo
echo "🔗 新的访问地址:"
echo "- 前端: https://$NEW_DOMAIN"
echo "- 后端 API: https://$NEW_DOMAIN/storage-backend/"
echo
echo "💡 下一步操作:"
echo "1. 确保 DNS 解析已指向服务器 IP: 129.226.88.226"
echo "2. 等待 SSL 证书自动生成（Caddy 会自动处理）"
echo "3. 重新构建并部署前端:"
echo "   ./deploy-prod.sh p \"update domain to $NEW_DOMAIN\""
echo
echo "🔍 验证命令:"
echo "   curl -I https://$NEW_DOMAIN"
echo