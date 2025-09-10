# 📋 Excalidraw 部署文档

## 🌟 当前架构

### 服务器信息
- **服务器**: 47.236.17.67 (阿里云ECS)
- **域名**: excalidrawq.duckdns.org
- **HTTPS**: Caddy 自动管理 Let's Encrypt 证书
- **容器**: Docker + Nginx (端口3000)

### 架构图
```
[用户浏览器] 
    ↓ HTTPS:443
[Caddy反向代理] 
    ↓ HTTP:3000
[Docker容器(Nginx)] 
    ↓
[Excalidraw应用]
```

## 🚀 一键部署（推荐）

### 快速部署
```bash
./deploy-simple.sh
```

### 带提交信息的部署
```bash
./deploy-simple.sh "feat: add new drawing tools"
./deploy-simple.sh "fix: resolve color picker issue"
```

## 📝 部署流程说明

新的简化部署流程：
1. **本机**: 提交代码并推送到Git
2. **服务器**: 自动拉取最新代码
3. **服务器**: 构建Docker镜像
4. **服务器**: 重启容器

**优势**:
- ✅ 无需本机Docker环境
- ✅ 无需传输大镜像文件
- ✅ 部署速度快（~2分钟）
- ✅ 流程简单，易维护

## 🔧 手动部署步骤

如果需要手动部署，按以下步骤操作：

### 1. SSH登录服务器
```bash
ssh -i ~/tools/pem/aliyun_sg01.pem root@47.236.17.67
```

### 2. 进入项目目录
```bash
cd /root/excalidrawQ
```

### 3. 拉取最新代码
```bash
git pull origin qiang
```

### 4. 构建Docker镜像
```bash
docker build -t excalidraw .
```

### 5. 重启容器
```bash
# 停止旧容器
docker stop excalidraw-app
docker rm excalidraw-app

# 启动新容器
docker run -d \
    --name excalidraw-app \
    -p 3000:80 \
    --restart unless-stopped \
    excalidraw
```

## 🛠 服务管理

### 查看服务状态
```bash
# Caddy状态
systemctl status caddy

# 容器状态
docker ps

# 容器资源使用
docker stats excalidraw-app
```

### 查看日志
```bash
# 容器日志
docker logs -f excalidraw-app

# Caddy日志
journalctl -u caddy -f

# 访问日志
tail -f /var/log/caddy/access.log
```

### 重启服务
```bash
# 重启容器
docker restart excalidraw-app

# 重启Caddy
systemctl restart caddy

# 重启整个系统
reboot
```

## 🌐 访问方式

### 生产环境
- **主域名**: https://excalidrawq.duckdns.org
- **HTTP重定向**: http://excalidrawq.duckdns.org → HTTPS

### 测试访问
```bash
# 测试HTTPS
curl -I https://excalidrawq.duckdns.org

# 测试HTTP重定向
curl -I http://excalidrawq.duckdns.org

# 测试容器直连
curl -I http://47.236.17.67:3000
```

## 🔍 故障排查

### 常见问题

**1. 部署脚本连接失败**
```bash
# 检查SSH密钥
ls -la ~/tools/pem/aliyun_sg01.pem
chmod 600 ~/tools/pem/aliyun_sg01.pem

# 测试连接
ssh -i ~/tools/pem/aliyun_sg01.pem root@47.236.17.67 "echo '连接成功'"
```

**2. Git推送失败**
```bash
# 检查远程仓库
git remote -v

# 重新设置远程仓库
git remote set-url origin <your-repo-url>
```

**3. Docker构建失败**
```bash
# 清理Docker缓存
docker system prune -f

# 检查磁盘空间
df -h

# 手动构建查看详细错误
docker build -t excalidraw . --no-cache
```

**4. 容器启动失败**
```bash
# 查看容器日志
docker logs excalidraw-app

# 检查端口占用
netstat -tuln | grep 3000

# 检查镜像
docker images | grep excalidraw
```

**5. HTTPS证书问题**
```bash
# 查看Caddy状态
systemctl status caddy

# 重新获取证书
systemctl restart caddy

# 检查证书
curl -vI https://excalidrawq.duckdns.org
```

### 日志分析
```bash
# 部署脚本输出
./deploy-simple.sh 2>&1 | tee deploy.log

# 服务器端完整日志
ssh -i ~/tools/pem/aliyun_sg01.pem root@47.236.17.67 "
docker logs excalidraw-app --tail 50
journalctl -u caddy --tail 20
"
```

## 📊 监控和维护

### 服务器资源监控
```bash
# 系统资源使用
htop
free -h
df -h

# Docker资源使用
docker stats
docker system df
```

### 定期维护
```bash
# 清理Docker资源（每周）
docker system prune -f

# 更新系统包（每月）
yum update -y

# 查看服务器运行时间
uptime
```

### 自动备份建议
```bash
# 备份项目代码（已通过Git管理）
# 备份Caddy配置
cp /etc/caddy/Caddyfile ~/backup/

# 备份SSL证书目录（可选，Caddy会自动续期）
cp -r ~/.local/share/caddy ~/backup/
```

## 🔐 安全配置

### 当前安全措施
- ✅ HTTPS强制重定向
- ✅ 严格传输安全(HSTS)
- ✅ 防XSS保护
- ✅ 防点击劫持
- ✅ MIME类型嗅探保护

### 安全建议
1. **定期更新系统**
   ```bash
   yum update -y
   ```

2. **监控登录日志**
   ```bash
   tail -f /var/log/secure
   ```

3. **防火墙确认**
   ```bash
   # 确保80,443端口开放
   firewall-cmd --list-all
   ```

## 📈 性能优化

### 当前优化配置
- ✅ Gzip压缩 (Caddy)
- ✅ 静态文件缓存 (Nginx)
- ✅ HTTP/2支持 (Caddy)
- ✅ 容器资源限制

### 进一步优化建议
```bash
# 启用Caddy缓存
# 在Caddyfile中添加:
# header Cache-Control "public, max-age=3600"

# 容器资源限制
docker update --memory=512m --cpus=1 excalidraw-app
```

## 🔄 版本管理

### 分支策略
- **开发分支**: `qiang`
- **部署流程**: 修改代码 → git push → ./deploy-simple.sh

### 回滚操作
```bash
# 1. 回滚到上个版本
git log --oneline -5  # 查看提交历史
git checkout <previous-commit>
./deploy-simple.sh "rollback to stable version"

# 2. 或者手动在服务器回滚
ssh -i ~/tools/pem/aliyun_sg01.pem root@47.236.17.67
cd /root/excalidrawQ
git checkout <previous-commit>
# 然后手动重建容器
```

## 🆘 紧急联系

### 快速恢复步骤
1. **服务器无响应**: 重启服务器
2. **HTTPS失效**: `systemctl restart caddy`
3. **应用异常**: `docker restart excalidraw-app`
4. **完全重建**: 运行 `./deploy-simple.sh`

### 备用访问方式
- IP直连: http://47.236.17.67:3000 (仅用于调试)

---

## 📞 技术支持

遇到问题时的排查顺序：
1. 检查 `./deploy-simple.sh` 输出信息
2. SSH到服务器查看 `docker logs excalidraw-app`
3. 检查 `systemctl status caddy`
4. 检查服务器资源: `htop`, `df -h`