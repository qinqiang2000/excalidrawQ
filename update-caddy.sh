#!/bin/bash

# Caddy 配置更新脚本（支持分享功能）
set -e

echo "========================================"
echo "       更新 Caddy 配置"
echo "========================================"

echo "📝 更新 Caddy 配置以支持分享功能..."

ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 << 'EOF'
    echo "💾 备份现有配置..."
    if [ -f "/etc/caddy/Caddyfile" ]; then
        cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup.$(date +%Y%m%d_%H%M%S)
    fi

    echo "📝 创建新的 Caddy 配置..."
    cat > /etc/caddy/Caddyfile << 'CADDY'
# Excalidraw 完整配置（前端 + 后端分享功能）
excalidrawx.duckdns.org {
    # 前端应用
    reverse_proxy / localhost:3000

    # Excalidraw Complete 存储后端
    reverse_proxy /storage-backend/* localhost:3002 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }

    # WebSocket 支持（协作功能）
    @websocket {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websocket localhost:3002

    # Socket.IO 特定路径
    reverse_proxy /socket.io/* localhost:3002

    # 启用 gzip 压缩
    encode gzip

    # CORS 头部（为存储后端）
    header /storage-backend/* {
        Access-Control-Allow-Origin "https://excalidrawx.duckdns.org"
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Access-Control-Allow-Headers "Content-Type"
    }

    # 安全头
    header {
        # 启用 HSTS
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

        # 防止 XSS
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        X-XSS-Protection "1; mode=block"

        # 删除服务器信息
        -Server
    }

    # 日志
    log {
        output file /var/log/caddy/access.log {
            roll_size 100MB
            roll_keep 5
        }
    }
}
CADDY

    echo "🔍 验证 Caddy 配置..."
    if caddy validate --config /etc/caddy/Caddyfile; then
        echo "✅ 配置验证通过"

        echo "🔄 重载 Caddy 配置..."
        caddy reload --config /etc/caddy/Caddyfile

        echo "⏳ 等待配置生效..."
        sleep 3

        echo "✅ Caddy 配置更新完成！"

        echo "📊 检查 Caddy 状态..."
        systemctl status caddy --no-pager -l

    else
        echo "❌ 配置验证失败！"
        echo "🔙 恢复备份配置..."
        if [ -f "/etc/caddy/Caddyfile.backup.$(date +%Y%m%d)_"* ]; then
            cp /etc/caddy/Caddyfile.backup.$(date +%Y%m%d)_* /etc/caddy/Caddyfile
            caddy reload --config /etc/caddy/Caddyfile
        fi
        exit 1
    fi
EOF

echo
echo "🎉 Caddy 配置更新完成！"
echo
echo "📍 新增功能："
echo "- /storage-backend/* → Excalidraw Complete 后端"
echo "- WebSocket 支持协作功能"
echo "- CORS 配置支持分享功能"
echo
echo "🔗 测试链接："
echo "- 前端: https://excalidrawx.duckdns.org"
echo "- 后端健康检查: https://excalidrawx.duckdns.org/storage-backend/"
echo
echo "💡 下一步："
echo "运行 ./deploy-prod.sh p \"启用分享功能\" 重新部署前端"
echo