# Excalidraw Storage Backend

简单的 Express.js 后端，为 Excalidraw 提供分享功能支持。

## 功能

- **分享保存**: `POST /api/v2/post/` - 保存画板数据并返回分享链接
- **分享加载**: `GET /api/v2/:id` - 根据ID获取画板数据
- **健康检查**: `GET /api/v2/` - 服务状态检查
- **统计信息**: `GET /api/v2/stats` - 存储统计（调试用）

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 开发模式
npm run dev
```

## 环境变量

- `PORT`: 服务端口 (默认: 3002)
- `CORS_ORIGIN`: 允许的源域名 (默认: https://excalidrawx.duckdns.org)

## API 接口

### POST /api/v2/post/
保存画板数据

**请求体**:
```json
{
  "elements": [...],
  "appState": {...},
  "files": {...}
}
```

**响应**:
```json
{
  "id": "uuid",
  "url": "https://domain/api/v2/uuid"
}
```

### GET /api/v2/:id
获取画板数据

**响应**:
```json
{
  "elements": [...],
  "appState": {...},
  "files": {...}
}
```

## 存储

目前使用内存存储，重启后数据会丢失。生产环境建议使用：
- Redis
- 数据库 (PostgreSQL, MySQL)
- 文件系统

## 部署

1. 上传代码到服务器
2. 安装依赖: `npm install`
3. 设置环境变量
4. 启动服务: `npm start`
5. 配置反向代理 (Nginx/Caddy)