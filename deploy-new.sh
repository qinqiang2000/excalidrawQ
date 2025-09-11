#!/bin/bash

# Excalidraw 持续部署脚本
# 用于本地更新代码后一键部署到服务器

set -e  # 遇到错误立即退出

# 服务器配置
SERVER_IP="43.134.26.236"
SSH_KEY="$HOME/tools/pem/ty_sg01.pem"
SERVER_USER="root"
PROJECT_DIR="/root/excalidrawQ"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 SSH 密钥是否存在
check_ssh_key() {
    if [ ! -f "$SSH_KEY" ]; then
        print_error "SSH 密钥文件不存在: $SSH_KEY"
        exit 1
    fi
    
    # 设置正确的权限
    chmod 600 "$SSH_KEY"
    print_info "SSH 密钥权限已设置"
}

# 检查本地是否有未提交的更改
check_local_changes() {
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "发现未提交的本地更改"
        git status
        echo
        read -p "是否要提交这些更改？(y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -p "请输入提交信息: " commit_msg
            git add .
            git commit -m "$commit_msg"
            print_success "代码已提交"
        fi
    fi
}

# 推送代码到远程仓库
push_code() {
    print_info "推送代码到远程仓库..."
    git push excalidrawQ qiang
    print_success "代码推送完成"
}

# 部署到服务器
deploy_to_server() {
    print_info "开始部署到服务器..."
    
    # SSH 连接并执行部署命令
    ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "
        set -e
        echo '进入项目目录...'
        cd '$PROJECT_DIR'
        
        echo '拉取最新代码...'
        git pull origin qiang
        
        # 检查 package.json 或 yarn.lock 是否有变化
        if git diff --name-only HEAD@{1} HEAD | grep -q 'package.json\|yarn.lock'; then
            echo '检测到依赖变更，安装依赖...'
            yarn install
        else
            echo '依赖无变化，跳过安装'
        fi
        
        echo '构建项目...'
        yarn build
        
        echo '重启服务...'
        systemctl restart excalidraw
        
        echo '检查服务状态...'
        systemctl is-active --quiet excalidraw && echo '✅ Excalidraw 服务运行正常' || echo '❌ Excalidraw 服务启动失败'
        
        echo '部署完成！'
    "
}

# 主函数
main() {
    echo
    echo "========================================"
    echo "     Excalidraw 持续部署脚本"
    echo "========================================"
    echo
    
    # 如果提供了参数，使用它作为提交信息
    if [ -n "$1" ]; then
        print_info "使用提供的提交信息: $1"
        check_local_changes
        git add .
        git commit -m "$1" || true
    fi
    
    # 执行部署步骤
    check_ssh_key
    check_local_changes
    push_code
    deploy_to_server
    
    echo
    print_success "🎉 部署完成！"
    echo
    echo "访问地址: https://excalidrawx.duckdns.org"
    echo
    echo "查看服务状态:"
    echo "  ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP 'systemctl status excalidraw'"
    echo
}

# 运行主函数
main "$@"