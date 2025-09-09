#!/bin/bash

# Excalidraw自动部署脚本 - 本机构建和传输
# 使用方法: ./deploy.sh [服务器IP]

set -e  # 遇到错误立即退出

# 配置变量
DEFAULT_SERVER="120.77.56.227"
SERVER=${1:-$DEFAULT_SERVER}
SSH_KEY="~/tools/pem/ecs_label_studio_1.pem"
IMAGE_NAME="excalidraw-custom"
TAR_FILE="excalidraw-custom.tar"
PROJECT_ROOT="/Users/qinqiang02/colab/codespace/frontend/excalidraw"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 检查先决条件
check_prerequisites() {
    print_step "检查先决条件..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker未安装"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker服务未启动"
        exit 1
    fi
    
    if [ ! -f "${SSH_KEY/#\~/$HOME}" ]; then
        print_error "SSH密钥文件不存在: $SSH_KEY"
        exit 1
    fi
    
    if [ ! -d "$PROJECT_ROOT" ]; then
        print_error "项目目录不存在: $PROJECT_ROOT"
        exit 1
    fi
    
    print_success "先决条件检查通过"
}

# 清理函数
cleanup() {
    print_step "清理临时文件..."
    if [ -f "$TAR_FILE" ]; then
        rm -f "$TAR_FILE"
        print_success "已删除临时镜像文件"
    fi
}

# 捕获退出信号，确保清理
trap cleanup EXIT

# 构建Docker镜像
build_image() {
    print_step "构建Docker镜像..."
    cd "$PROJECT_ROOT"
    
    # 检查是否在正确的git分支
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "qiang" ]; then
        print_warning "当前分支: $CURRENT_BRANCH (不是qiang分支)"
        read -p "是否继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "用户取消操作"
            exit 1
        fi
    fi
    
    # 构建 x86_64 架构镜像以兼容服务器
    docker build --platform linux/amd64 -t "$IMAGE_NAME" . || {
        print_error "Docker镜像构建失败"
        exit 1
    }
    
    print_success "Docker镜像构建完成"
}

# 导出镜像
export_image() {
    print_step "导出Docker镜像..."
    
    docker save "$IMAGE_NAME" -o "$TAR_FILE" || {
        print_error "镜像导出失败"
        exit 1
    }
    
    # 显示文件大小
    SIZE=$(du -h "$TAR_FILE" | cut -f1)
    print_success "镜像已导出: $TAR_FILE ($SIZE)"
}

# 传输到服务器
transfer_image() {
    print_step "传输镜像到服务器 $SERVER..."
    
    # 测试连接
    ssh -i "${SSH_KEY/#\~/$HOME}" -o ConnectTimeout=10 -o BatchMode=yes root@"$SERVER" exit || {
        print_error "无法连接到服务器 $SERVER"
        exit 1
    }
    
    # 传输文件，显示进度
    scp -i "${SSH_KEY/#\~/$HOME}" -o ConnectTimeout=30 "$TAR_FILE" root@"$SERVER":/root/ || {
        print_error "文件传输失败"
        exit 1
    }
    
    print_success "镜像已传输到服务器"
}

# 在服务器上执行部署
deploy_on_server() {
    print_step "在服务器上部署..."
    
    ssh -i "${SSH_KEY/#\~/$HOME}" root@"$SERVER" << 'EOF'
set -e

IMAGE_NAME="excalidraw-custom"
TAR_FILE="excalidraw-custom.tar"
CONTAINER_NAME="excalidraw-app"
PORT="9999"

echo "[$(date '+%H:%M:%S')] 停止并删除旧容器..."
if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
    echo "✓ 旧容器已停止并删除"
fi

echo "[$(date '+%H:%M:%S')] 删除旧镜像..."
if docker images -q $IMAGE_NAME | grep -q .; then
    docker rmi $IMAGE_NAME
    echo "✓ 旧镜像已删除"
fi

echo "[$(date '+%H:%M:%S')] 导入新镜像..."
docker load -i /root/$TAR_FILE
echo "✓ 新镜像已导入"

echo "[$(date '+%H:%M:%S')] 启动新容器..."
docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:80 \
    --restart unless-stopped \
    $IMAGE_NAME
echo "✓ 新容器已启动"

echo "[$(date '+%H:%M:%S')] 清理临时文件..."
rm -f /root/$TAR_FILE
echo "✓ 临时文件已清理"

echo "[$(date '+%H:%M:%S')] 检查容器状态..."
if docker ps | grep -q $CONTAINER_NAME; then
    echo "✓ 容器运行正常"
    echo "📱 访问地址: http://$(curl -s ifconfig.me):$PORT"
else
    echo "✗ 容器启动失败"
    docker logs $CONTAINER_NAME
    exit 1
fi
EOF

    if [ $? -eq 0 ]; then
        print_success "服务器部署完成"
    else
        print_error "服务器部署失败"
        exit 1
    fi
}

# 主函数
main() {
    echo "🚀 Excalidraw自动部署开始"
    echo "目标服务器: $SERVER"
    echo "项目路径: $PROJECT_ROOT"
    echo "=========================="
    
    check_prerequisites
    build_image
    export_image
    transfer_image
    deploy_on_server
    
    echo "=========================="
    print_success "🎉 部署完成！"
    echo -e "${BLUE}访问地址: http://$SERVER:9999${NC}"
}

# 执行主函数
main "$@"