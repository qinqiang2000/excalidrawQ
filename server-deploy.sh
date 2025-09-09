#!/bin/bash

# Excalidraw服务器端单独部署脚本
# 使用方法: 在服务器上运行 ./server-deploy.sh

set -e

# 配置变量
IMAGE_NAME="excalidraw-custom"
TAR_FILE="excalidraw-custom.tar"
CONTAINER_NAME="excalidraw-app"
PORT="9999"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 检查Docker
check_docker() {
    print_step "检查Docker环境..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker未安装"
        echo "安装命令:"
        echo "yum install -y yum-utils"
        echo "yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo"
        echo "yum install -y docker-ce docker-ce-cli containerd.io"
        echo "systemctl start docker && systemctl enable docker"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker服务未启动"
        echo "启动命令: systemctl start docker"
        exit 1
    fi
    
    print_success "Docker环境正常"
}

# 检查镜像文件
check_image_file() {
    print_step "检查镜像文件..."
    
    if [ ! -f "/root/$TAR_FILE" ]; then
        print_error "镜像文件不存在: /root/$TAR_FILE"
        echo "请先运行本机的deploy.sh脚本传输镜像文件"
        exit 1
    fi
    
    SIZE=$(du -h "/root/$TAR_FILE" | cut -f1)
    print_success "找到镜像文件: $TAR_FILE ($SIZE)"
}

# 停止旧容器
stop_old_container() {
    print_step "处理旧容器..."
    
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        print_warning "发现运行中的容器: $CONTAINER_NAME"
        docker stop $CONTAINER_NAME
        print_success "已停止旧容器"
    fi
    
    if docker ps -a -q -f name=$CONTAINER_NAME | grep -q .; then
        docker rm $CONTAINER_NAME
        print_success "已删除旧容器"
    fi
}

# 清理旧镜像
remove_old_image() {
    print_step "清理旧镜像..."
    
    if docker images -q $IMAGE_NAME | grep -q .; then
        print_warning "发现旧镜像: $IMAGE_NAME"
        docker rmi $IMAGE_NAME
        print_success "已删除旧镜像"
    fi
}

# 导入新镜像
load_new_image() {
    print_step "导入新镜像..."
    
    docker load -i "/root/$TAR_FILE" || {
        print_error "镜像导入失败"
        exit 1
    }
    
    print_success "新镜像已导入"
}

# 启动新容器
start_new_container() {
    print_step "启动新容器..."
    
    # 检查端口是否被占用
    if netstat -tuln | grep -q ":$PORT "; then
        print_warning "端口 $PORT 可能被占用"
    fi
    
    docker run -d \
        --name $CONTAINER_NAME \
        -p $PORT:80 \
        --restart unless-stopped \
        $IMAGE_NAME || {
        print_error "容器启动失败"
        docker logs $CONTAINER_NAME
        exit 1
    }
    
    print_success "新容器已启动"
}

# 验证部署
verify_deployment() {
    print_step "验证部署状态..."
    
    # 等待容器启动
    sleep 3
    
    if ! docker ps | grep -q $CONTAINER_NAME; then
        print_error "容器未正常运行"
        echo "容器日志:"
        docker logs $CONTAINER_NAME
        exit 1
    fi
    
    # 检查端口监听
    if netstat -tuln | grep -q ":$PORT "; then
        print_success "端口 $PORT 监听正常"
    else
        print_warning "端口 $PORT 未监听，请检查容器状态"
    fi
    
    print_success "部署验证通过"
}

# 清理临时文件
cleanup() {
    print_step "清理临时文件..."
    
    if [ -f "/root/$TAR_FILE" ]; then
        rm -f "/root/$TAR_FILE"
        print_success "已删除镜像文件"
    fi
}

# 显示状态信息
show_status() {
    print_step "部署状态信息..."
    
    echo "=========================="
    echo "容器状态:"
    docker ps --filter name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo
    
    echo "系统资源:"
    echo "CPU使用: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
    echo "内存使用: $(free | grep Mem | awk '{printf("%.1f%%\n", $3/$2 * 100.0)}')"
    echo "磁盘使用: $(df -h / | tail -1 | awk '{print $5}')"
    echo
    
    # 获取外网IP
    EXTERNAL_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "获取失败")
    INTERNAL_IP=$(hostname -I | awk '{print $1}')
    
    echo "访问地址:"
    echo "  外网: http://$EXTERNAL_IP:$PORT"
    echo "  内网: http://$INTERNAL_IP:$PORT"
    echo "=========================="
}

# 主函数
main() {
    echo "🚀 Excalidraw服务器端部署开始"
    echo "镜像名称: $IMAGE_NAME"
    echo "容器名称: $CONTAINER_NAME"
    echo "监听端口: $PORT"
    echo "=========================="
    
    check_docker
    check_image_file
    stop_old_container
    remove_old_image
    load_new_image
    start_new_container
    verify_deployment
    cleanup
    show_status
    
    echo "=========================="
    print_success "🎉 服务器端部署完成！"
}

# 显示帮助信息
show_help() {
    cat << EOF
Excalidraw服务器端部署脚本

用法:
    $0              # 执行完整部署流程
    $0 -h|--help    # 显示此帮助信息
    $0 status       # 显示当前状态
    $0 logs         # 显示容器日志
    $0 restart      # 重启容器
    $0 stop         # 停止容器
    $0 start        # 启动容器

前置条件:
    1. 镜像文件存在: /root/$TAR_FILE
    2. Docker已安装并启动
    3. 端口 $PORT 可用

注意:
    - 此脚本会停止并删除同名的旧容器
    - 会删除同名的旧镜像
    - 建议在执行前备份重要数据
EOF
}

# 处理命令行参数
case "${1:-deploy}" in
    "deploy"|"")
        main
        ;;
    "status")
        show_status
        ;;
    "logs")
        if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
            docker logs -f $CONTAINER_NAME
        else
            print_error "容器 $CONTAINER_NAME 未运行"
        fi
        ;;
    "restart")
        if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
            docker restart $CONTAINER_NAME
            print_success "容器已重启"
        else
            print_error "容器 $CONTAINER_NAME 未运行"
        fi
        ;;
    "stop")
        if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
            docker stop $CONTAINER_NAME
            print_success "容器已停止"
        else
            print_warning "容器 $CONTAINER_NAME 未运行"
        fi
        ;;
    "start")
        if docker ps -a -q -f name=$CONTAINER_NAME | grep -q .; then
            docker start $CONTAINER_NAME
            print_success "容器已启动"
        else
            print_error "容器 $CONTAINER_NAME 不存在"
        fi
        ;;
    "-h"|"--help")
        show_help
        ;;
    *)
        print_error "未知命令: $1"
        show_help
        exit 1
        ;;
esac