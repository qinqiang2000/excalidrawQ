# Excalidraw CentOS 7 部署指南

## 🚀 快速部署

### 一键部署（推荐）
```bash
# 在项目根目录执行
./deploy.sh
```

### 指定服务器IP部署
```bash
./deploy.sh 192.168.1.100
```

## 📋 脚本说明

### 1. deploy.sh - 本机构建传输脚本
**功能:**
- 自动构建Docker镜像
- 导出镜像为tar文件
- 传输到目标服务器
- 在服务器上自动部署
- 清理临时文件

**使用方法:**
```bash
./deploy.sh                    # 部署到默认服务器(120.77.56.227)
./deploy.sh 192.168.1.100      # 部署到指定服务器
```

### 2. server-deploy.sh - 服务器端独立脚本
**功能:**
- 停止旧容器
- 导入新镜像
- 启动新容器
- 状态检查和管理

**使用方法:**
```bash
# 在服务器上执行
./server-deploy.sh              # 完整部署流程
./server-deploy.sh status       # 查看状态
./server-deploy.sh logs         # 查看日志
./server-deploy.sh restart      # 重启容器
./server-deploy.sh stop         # 停止容器
./server-deploy.sh start        # 启动容器
```

## 🔧 环境要求

### 本机要求
- Docker已安装并启动
- SSH密钥: `~/tools/pem/ecs_label_studio_1.pem`
- 网络能访问目标服务器

### 服务器要求(CentOS 7)
- Docker已安装: `yum install -y docker-ce`
- Docker已启动: `systemctl start docker`
- 端口9999可用(可在脚本中修改)

## 📁 项目结构
```
excalidraw/
├── deploy.sh              # 本机部署脚本
├── server-deploy.sh       # 服务器部署脚本  
├── Dockerfile             # Docker构建文件
├── excalidraw-app/        # 应用源码
└── packages/              # 核心包
```

## 🌐 访问方式

部署成功后可通过以下方式访问:
- **外网**: `http://服务器IP:9999`
- **内网**: `http://内网IP:9999`

## 🛠 故障排查

### 常见问题

**1. Docker镜像构建失败**
```bash
# 检查Docker服务
docker info
# 清理构建缓存
docker system prune -f
```

**2. SSH连接失败**
```bash
# 检查密钥权限
chmod 600 ~/tools/pem/ecs_label_studio_1.pem
# 测试连接
ssh -i ~/tools/pem/ecs_label_studio_1.pem root@120.77.56.227
```

**3. 端口占用**
```bash
# 检查端口占用
netstat -tuln | grep 9999
# 修改脚本中的PORT变量
```

**4. 容器启动失败**
```bash
# 查看容器日志
docker logs excalidraw-app
# 检查镜像
docker images | grep excalidraw
```

### 日志查看
```bash
# 本机查看构建日志
docker build -t excalidraw-custom . 2>&1 | tee build.log

# 服务器查看容器日志
docker logs -f excalidraw-app

# 服务器查看部署脚本日志
./server-deploy.sh logs
```

## 🔄 更新部署

### 日常更新流程
1. 修改代码
2. 提交到qiang分支
3. 运行 `./deploy.sh`

### 回滚操作
```bash
# 如需回滚，重新构建之前的代码
git checkout 上一个版本的commit
./deploy.sh
```

## 📊 监控和维护

### 容器状态检查
```bash
# 在服务器上
./server-deploy.sh status
docker ps
docker stats excalidraw-app
```

### 资源监控
```bash
# CPU和内存使用
top
free -h
df -h
```

### 自动重启策略
容器已配置 `--restart unless-stopped`，系统重启后会自动启动。

## 🔐 安全建议

1. **SSH密钥安全**
   - 定期更换SSH密钥
   - 确保密钥文件权限为600

2. **防火墙配置**
   ```bash
   # CentOS 7防火墙设置
   firewall-cmd --permanent --add-port=9999/tcp
   firewall-cmd --reload
   ```

3. **定期更新**
   - 定期更新Docker镜像
   - 更新系统安全补丁

## 📞 技术支持

如遇到问题:
1. 查看脚本输出的错误信息
2. 检查Docker和SSH服务状态
3. 查看容器日志: `docker logs excalidraw-app`
4. 使用 `./server-deploy.sh status` 检查部署状态