# 📋 Excalidraw 部署文档

## 🌟 当前架构

### 服务器信息

- **服务器**: 129.226.88.226 (腾讯云)
- **域名**: excalidrawx.duckdns.org
- **HTTPS**: 通过 Caddy 自动管理
- **前端服务**: http-server (生产) / Vite dev server (开发)
- **后端服务**: 自定义存储后端 (分享功能)

### 完整部署架构

```
[用户浏览器]
    ↓ HTTPS:443
[Caddy 反向代理]
    ├─ HTTP:3000 → [前端服务]
    └─ HTTP:3002 → [自定义存储后端]
    ↓
[分离存储]
├── 代码文件 (/root/excalidraw-app-build)
├── 字体文件 (/root/excalidraw-fonts)
└── 分享数据 (内存存储)
```

**架构优势**:
- ✅ 字体文件一次上传，永久使用
- ✅ 代码文件快速增量部署
- ✅ 本地构建，减轻服务器压力
- ✅ 灵活的开发/生产环境切换
- ✅ 完全独立的分享功能
- ✅ 自动 HTTPS 证书管理

## 🚀 部署方式

### 生产部署 (推荐)

```bash
# 生产部署
./deploy-prod.sh p "feat: add new drawing tools"

# 重新部署当前版本
./deploy-prod.sh p
```

### 开发部署

```bash
# 开发环境部署 (带热重载)
./deploy-simple-dev.sh "fix: resolve color picker issue"

# 重启开发服务器
./deploy-simple-dev.sh
```

### 首次部署

```bash
# 1. 首次需要上传字体文件
./upload-fonts.sh

# 2. 然后进行正常部署（存储后端已自动部署）
./deploy-prod.sh p "initial deployment with sharing support"
```

## 🔗 分享功能配置

### 架构说明

使用 **自定义 Express.js 后端** 实现独立分享功能：
- 内存存储分享数据（重启会丢失）
- Caddy 处理路由和 CORS
- 完全独立，不依赖第三方服务

### 关键文件

- `.env.local` - 环境配置（指向自己的后端）
- `storage-backend/` - 自定义存储后端代码
- `update-domain.sh` - 域名快速更换

### 服务管理

```bash
# 后端状态
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'systemctl status excalidraw-storage'

# 重启后端
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'systemctl restart excalidraw-storage'

# 查看存储统计
curl -s https://excalidrawx.duckdns.org/storage-backend/api/v2/stats

# 更换域名
./update-domain.sh new-domain.com && ./deploy-prod.sh p "update domain"
```

## 📝 部署流程说明

### 生产部署流程 (./deploy-prod.sh)

1. **本机**: 提交代码并推送到 Git
2. **本机**: 构建生产版本 (yarn build:app:docker)
3. **本机**: 排除字体文件，压缩代码文件
4. **服务器**: 上传并解压代码文件
5. **服务器**: 创建字体目录链接
6. **服务器**: 启动 http-server 静态服务

### 开发部署流程 (./deploy-simple-dev.sh)

1. **本机**: 提交代码并推送到 Git
2. **服务器**: 拉取最新代码
3. **服务器**: 安装依赖
4. **服务器**: 启动 Vite 开发服务器 (支持热重载)

**优势对比**:

| 特性 | 生产部署 | 开发部署 |
|------|---------|---------|
| 构建位置 | 本地 | 服务器 |
| 服务类型 | 静态文件服务 | 开发服务器 |
| 热重载 | ❌ | ✅ |
| 启动速度 | 快 | 中等 |
| 内存占用 | 低 | 高 |
| 适用场景 | 生产环境 | 开发调试 |

## 🔧 手动部署步骤

如果需要手动部署，按以下步骤操作：

### 1. SSH 登录服务器

```bash
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226
```

### 2. 进入项目目录

```bash
cd /root/excalidrawQ
```

### 3. 拉取最新代码

```bash
git pull excalidrawQ qiang
```

### 4. 手动构建和部署

```bash
# 停止现有服务
pkill -f "http-server" || true
pkill -f "vite" || true

# 进入应用目录
cd excalidraw-app

# 安装依赖并构建
yarn install
yarn build:app:docker

# 创建部署目录并复制文件
mkdir -p /root/excalidraw-app-build
cp -r build/* /root/excalidraw-app-build/

# 创建字体链接
cd /root/excalidraw-app-build
ln -sf /root/excalidraw-fonts fonts

# 启动服务
nohup npx http-server . -a 0.0.0.0 -p 3000 --cors -c-1 > /var/log/excalidraw-prod.log 2>&1 &
```

## 🛠 服务管理

### 查看服务状态

```bash
# 查看运行的进程
pgrep -f "http-server"
pgrep -f "vite"

# 查看端口监听
netstat -tuln | grep 3000

# 查看进程详情
ps aux | grep -E "(http-server|vite)"
```

### 查看日志

```bash
# 生产服务日志
tail -f /var/log/excalidraw-prod.log

# 开发服务日志
tail -f /var/log/excalidraw-dev.log

# 系统日志
journalctl -f
```

### 重启服务

```bash
# 重启生产服务
pkill -f "http-server"
cd /root/excalidraw-app-build
nohup npx http-server . -a 0.0.0.0 -p 3000 --cors -c-1 > /var/log/excalidraw-prod.log 2>&1 &

# 重启开发服务
pkill -f "vite"
cd /root/excalidrawQ/excalidraw-app
nohup VITE_APP_ENABLE_PWA=true PORT=3000 yarn start --host 0.0.0.0 > /var/log/excalidraw-dev.log 2>&1 &
```

## 🌐 访问方式

### 生产环境

- **主域名**: https://excalidrawx.duckdns.org
- **HTTP 重定向**: http://excalidrawx.duckdns.org → HTTPS

### 测试访问

```bash
# 测试HTTPS
curl -I https://excalidrawx.duckdns.org

# 测试HTTP重定向
curl -I http://excalidrawx.duckdns.org

# 测试服务器直连
curl -I http://129.226.88.226:3000
```

## 🔍 故障排查

### 常见问题

**1. 部署脚本连接失败**

```bash
# 检查SSH密钥
ls -la ~/tools/pem/ty_sg01.pem
chmod 600 ~/tools/pem/ty_sg01.pem

# 测试连接
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 "echo '连接成功'"
```

**2. Git 推送失败**

```bash
# 检查远程仓库
git remote -v

# 重新设置远程仓库
git remote set-url excalidrawQ <your-repo-url>
```

**3. 构建失败**

```bash
# 清理依赖重新安装
rm -rf node_modules yarn.lock
yarn install

# 检查 Node.js 版本
node --version  # 建议使用 Node.js 18+

# 检查磁盘空间
df -h
```

**4. 服务启动失败**

```bash
# 查看服务进程
ps aux | grep -E "(http-server|vite)"

# 检查端口占用
netstat -tuln | grep 3000
lsof -i :3000

# 查看错误日志
tail -f /var/log/excalidraw-prod.log
tail -f /var/log/excalidraw-dev.log
```

**5. 字体文件缺失**

```bash
# 检查字体目录
ls -la /root/excalidraw-fonts

# 检查字体链接
ls -la /root/excalidraw-app-build/fonts

# 重新上传字体
./upload-fonts.sh
```

**6. 分享功能失败**

```bash
# 检查后端服务
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'systemctl status excalidraw-storage'

# 查看后端日志
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'journalctl -u excalidraw-storage -f'

# 检查 Caddy 配置
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'caddy validate --config /etc/caddy/Caddyfile'

# 测试后端 API
curl -s https://excalidrawx.duckdns.org/storage-backend/
curl -s https://excalidrawx.duckdns.org/storage-backend/api/v2/stats
```

### 日志分析

```bash
# 部署脚本输出
./deploy-prod.sh p "test" 2>&1 | tee deploy.log

# 服务器端完整日志
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 "
tail -50 /var/log/excalidraw-prod.log
tail -20 /var/log/excalidraw-dev.log
free -h
df -h
"
```

## 📊 监控和维护

### 服务器资源监控

```bash
# 系统资源使用
htop
free -h
df -h

# 进程资源使用
ps aux --sort=-%cpu | head -10
ps aux --sort=-%mem | head -10
```

### 定期维护

```bash
# 清理临时文件（每周）
rm -f /tmp/excalidraw-*.tar.gz
find /tmp -name "excalidraw-*" -type d -mtime +7 -exec rm -rf {} +

# 更新系统包（每月）
yum update -y

# 查看服务器运行时间
uptime

# 检查磁盘使用情况
du -sh /root/excalidraw*
```

### 自动备份建议

```bash
# 备份项目代码（已通过Git管理）
# 备份部署脚本
cp deploy-*.sh ~/backup/
cp upload-fonts.sh ~/backup/

# 备份字体文件（可选，较大）
tar -czf ~/backup/excalidraw-fonts-$(date +%Y%m%d).tar.gz /root/excalidraw-fonts
```

## 🔐 安全配置

### 当前安全措施

- ✅ SSH 密钥认证
- ✅ HTTPS 强制重定向
- ✅ 防火墙端口限制
- ✅ 非 root 用户运行服务 (推荐配置)

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
   # 确保80,443,3000端口开放
   firewall-cmd --list-all
   ```

## 📈 性能优化

### 当前优化配置

- ✅ Gzip 压缩 (http-server --cors)
- ✅ 静态文件缓存控制 (-c-1)
- ✅ 分离式架构减少传输
- ✅ 本地构建减轻服务器负载

### 进一步优化建议

```bash
# 使用PM2管理进程（推荐）
npm install -g pm2

# PM2配置文件 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'excalidraw-prod',
    script: 'npx',
    args: 'http-server . -a 0.0.0.0 -p 3000 --cors -c-1',
    cwd: '/root/excalidraw-app-build',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M'
  }]
};

# 启动PM2服务
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔄 版本管理

### 分支策略

- **开发分支**: `qiang`
- **部署流程**: 修改代码 → git push → ./deploy-prod.sh p

### 回滚操作

```bash
# 1. 回滚到上个版本
git log --oneline -5  # 查看提交历史
git checkout <previous-commit>
./deploy-prod.sh p "rollback to stable version"

# 2. 或者手动在服务器回滚
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226
cd /root/excalidrawQ
git checkout <previous-commit>
# 然后手动重新部署
```

## 🆘 紧急联系

### 快速恢复步骤

1. **服务器无响应**: 重启服务器
2. **服务异常**: `pkill -f "http-server" && ./deploy-prod.sh p`
3. **开发服务异常**: `pkill -f "vite" && ./deploy-simple-dev.sh`
4. **完全重建**: 运行 `./deploy-prod.sh p`

### 备用访问方式

- IP 直连: http://129.226.88.226:3000 (仅用于调试)

---

## 📞 技术支持

遇到问题时的排查顺序：

1. 检查部署脚本输出信息
2. SSH 到服务器查看进程状态: `ps aux | grep -E "(http-server|vite)"`
3. 检查服务日志: `tail -f /var/log/excalidraw-*.log`
4. 检查服务器资源: `htop`, `df -h`
5. 检查网络连接: `curl -I http://129.226.88.226:3000`

### 常用命令速查

```bash
# 快速部署
./deploy-prod.sh p "update message"

# 开发部署
./deploy-simple-dev.sh "dev update"

# 查看服务状态
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'ps aux | grep -E "(http-server|vite)"'

# 查看日志
ssh -i ~/tools/pem/ty_sg01.pem root@129.226.88.226 'tail -f /var/log/excalidraw-prod.log'
```