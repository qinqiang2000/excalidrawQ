#!/bin/bash

# Excalidraw 简化部署脚本
# 使用方法: ./deploy-simple.sh [commit-message]
# 
# 新架构: 本机推送代码 → 服务器自动构建 → 重启容器
# 优势: 无需本机Docker，无需传输镜像，部署更快

set -e  # 遇到错误立即退出

# 配置变量
SERVER="47.236.17.67"
SSH_KEY="~/tools/pem/aliyun_sg01.pem"
REMOTE_DIR="/root/excalidrawQ"
CONTAINER_NAME="excalidraw-app"
IMAGE_NAME="excalidraw"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}🚀 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 获取提交信息
COMMIT_MSG="${1:-Deploy: $(date '+%Y-%m-%d %H:%M:%S')}"

# 检查Git状态
check_git_status() {
    print_step "检查Git状态..."
    
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_warning "发现未提交的更改"
    fi
    
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "qiang" ]; then
        print_warning "当前分支: $CURRENT_BRANCH (建议使用qiang分支)"
        read -p "继续部署? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "部署已取消"
            exit 1
        fi
    fi
    
    print_success "Git状态检查完成"
}

# 推送代码
push_code() {
    print_step "推送代码到远程仓库..."
    
    # 添加所有更改
    git add .
    
    # 提交更改（如果有的话）
    if ! git diff --cached --quiet; then
        git commit -m "$COMMIT_MSG" || {
            print_warning "提交失败，可能没有更改需要提交"
        }
    fi
    
    # 推送到远程
    git push excalidrawQ qiang || {
        print_warning "推送失败，请检查网络连接和权限"
        exit 1
    }
    
    print_success "代码推送完成"
}

# 在服务器上部署
deploy_on_server() {
    print_step "连接服务器并部署..."
    
    # 测试连接
    if ! ssh -i "${SSH_KEY/#\~/$HOME}" -o ConnectTimeout=30 -o BatchMode=yes root@"$SERVER" exit 2>/dev/null; then
        print_warning "无法连接到服务器，请检查网络和SSH密钥"
        exit 1
    fi
    
    # 在服务器上执行部署（增加超时和保持连接）
    ssh -i "${SSH_KEY/#\~/$HOME}" -o ServerAliveInterval=60 -o ServerAliveCountMax=10 -o ConnectTimeout=30 root@"$SERVER" << EOF
set -e

# 进入项目目录
cd $REMOTE_DIR

echo "📥 拉取最新代码..."
git pull origin qiang

echo "🔨 构建Docker镜像（预计3-8分钟）..."
echo "⏳ 正在下载依赖和编译代码，请耐心等待..."
echo "📊 如果超过10分钟无响应，可按Ctrl+C取消"

# 设置Docker构建超时为600秒（10分钟）
timeout 600 docker build -t $IMAGE_NAME . || {
    echo "❌ Docker构建超时或失败"
    echo "💡 可能原因：网络慢、服务器资源不足"
    echo "🔄 建议：稍后重试或检查服务器资源"
    exit 1
}

echo "🔄 重启容器..."
# 停止并删除旧容器
if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    docker stop $CONTAINER_NAME
fi
if docker ps -a -q -f name=$CONTAINER_NAME | grep -q .; then
    docker rm $CONTAINER_NAME
fi

# 启动新容器
docker run -d \
    --name $CONTAINER_NAME \
    -p 3000:80 \
    --restart unless-stopped \
    $IMAGE_NAME

echo "✅ 容器启动完成"

# 检查容器状态
sleep 3
if docker ps | grep -q $CONTAINER_NAME; then
    echo "✅ 容器运行正常"
    echo "🌐 访问地址: https://excalidrawq.duckdns.org"
else
    echo "❌ 容器启动失败"
    docker logs $CONTAINER_NAME
    exit 1
fi

# 清理未使用的镜像（可选）
docker image prune -f

echo "🎉 部署完成！"
EOF
    
    if [ $? -eq 0 ]; then
        print_success "服务器部署完成"
    else
        print_warning "服务器部署失败"
        exit 1
    fi
}

# 显示部署信息
show_deployment_info() {
    echo
    echo "==============================="
    echo "🎉 部署成功完成!"
    echo "==============================="
    echo "📅 部署时间: $(date)"
    echo "💬 提交信息: $COMMIT_MSG"
    echo "🌐 访问地址: https://excalidrawq.duckdns.org"
    echo "📊 Caddy状态: systemctl status caddy"
    echo "🐳 容器状态: docker ps"
    echo "==============================="
}

# 主函数
main() {
    echo "🚀 开始Excalidraw简化部署..."
    echo "目标服务器: $SERVER"
    echo "提交信息: $COMMIT_MSG"
    echo "==============================="
    
    check_git_status
    push_code
    deploy_on_server
    show_deployment_info
}

# 显示帮助
show_help() {
    cat << EOF
Excalidraw 简化部署脚本

用法:
    $0 [提交信息]           # 部署并使用指定的提交信息
    $0                      # 使用默认提交信息部署
    $0 -h | --help          # 显示此帮助

示例:
    $0 "feat: add new drawing tools"
    $0 "fix: resolve color picker issue"

部署流程:
    1. 检查Git状态
    2. 提交并推送代码
    3. 服务器拉取代码
    4. 服务器构建Docker镜像
    5. 重启容器

访问地址:
    https://excalidrawq.duckdns.org

注意事项:
    - 确保SSH密钥存在: $SSH_KEY
    - 建议在qiang分支上开发
    - 服务器需要Docker和Git环境
EOF
}

# 处理命令行参数
case "${1:-}" in
    "-h"|"--help")
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac