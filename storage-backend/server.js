const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3002;

// 内存存储 - 生产环境可替换为 Redis 或数据库
const storage = new Map();

// CORS 配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['https://excalidrawx.duckdns.org', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

// 中间件配置 - 按路径分别处理
app.use('/health', express.json());
app.use('/api/v2/stats', express.json());
app.use('/storage-backend/api/v2/stats', express.json());

// Excalidraw 分享功能端点 - 使用二进制数据解析，接受所有 Content-Type
app.use('/api/v2/post/', express.raw({
  limit: '50mb',
  type: function(req) {
    // 接受所有类型的请求体作为二进制数据
    return true;
  }
}));
app.use('/storage-backend/api/v2/post/', express.raw({
  limit: '50mb',
  type: function(req) {
    // 接受所有类型的请求体作为二进制数据
    return true;
  }
}));

// 健康检查
const healthCheck = (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    storage: {
      count: storage.size,
      keys: Array.from(storage.keys()).slice(0, 5) // 只显示前5个key
    }
  });
};

// POST 保存画板数据 - 处理加密的二进制数据
const saveScene = (req, res) => {
  try {
    const id = uuidv4();

    // 基本调试信息
    console.log(`🔍 Received ${req.get('Content-Type')} data, size: ${req.body?.length || 0} bytes`);

    // 存储原始二进制数据（已压缩和加密）
    const binaryData = req.body; // Buffer
    storage.set(id, binaryData);

    console.log(`💾 Saved encrypted scene ${id}, size: ${binaryData?.length || 0} bytes`);

    // 返回符合 Excalidraw 期望的响应格式
    res.json({
      id: id
    });

  } catch (error) {
    console.error('❌ Error saving scene:', error);
    res.status(500).json({
      error: 'Failed to save scene',
      message: error.message
    });
  }
};

// GET 获取画板数据 - 返回加密的二进制数据
const getScene = (req, res) => {
  try {
    const { id } = req.params;
    const binaryData = storage.get(id);

    if (!binaryData) {
      console.log(`🔍 Scene ${id} not found`);
      return res.status(404).json({
        error: 'Scene not found',
        id: id
      });
    }

    console.log(`📤 Retrieved encrypted scene ${id}, size: ${binaryData.length} bytes`);

    // 返回原始二进制数据
    res.set('Content-Type', 'application/octet-stream');
    res.send(binaryData);

  } catch (error) {
    console.error('❌ Error retrieving scene:', error);
    res.status(500).json({
      error: 'Failed to retrieve scene',
      message: error.message
    });
  }
};

// 统计信息
const getStats = (req, res) => {
  const stats = {
    totalScenes: storage.size,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };

  console.log('📊 Stats requested:', stats);
  res.json(stats);
};

// 路由配置
app.get('/health', healthCheck);
app.get('/', healthCheck);  // 根路径健康检查
app.get('/storage-backend/', healthCheck);  // Caddy 转发路径

// POST /api/v2/post/ - 保存画板数据（Excalidraw 分享功能使用的端点）
app.post('/api/v2/post/', saveScene);
app.post('/storage-backend/api/v2/post/', saveScene);  // Caddy 转发路径

// GET 获取画板数据 - 支持多个路径
app.get('/api/v2/:id', getScene);
app.get('/storage-backend/api/v2/:id', getScene);  // Caddy 转发路径

// 统计信息
app.get('/api/v2/stats', getStats);
app.get('/storage-backend/api/v2/stats', getStats);  // Caddy 转发路径

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// 404 处理
app.use((req, res) => {
  console.log(`❓ 404 - ${req.method} ${req.url}`);
  res.status(404).json({
    error: 'Not found',
    path: req.url,
    method: req.method
  });
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
  console.log('🚀 Excalidraw Storage Backend Started');
  console.log(`📡 Server running on: http://0.0.0.0:${port}`);
  console.log('🔗 API Endpoints:');
  console.log(`   POST /api/v2/post/ - Save scene`);
  console.log(`   GET  /api/v2/:id - Get scene`);
  console.log(`   GET  /api/v2/stats - Get stats`);
  console.log(`   GET  /health - Health check`);
  console.log('📝 Caddy proxy paths also supported (/storage-backend/...)');
});