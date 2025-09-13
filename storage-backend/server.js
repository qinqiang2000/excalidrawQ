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

// 解析 JSON 请求体，支持大文件
app.use(express.json({ limit: '50mb' }));

// 健康检查 - 支持多个路径
const healthCheck = (req, res) => {
  res.json({
    status: 'ok',
    message: 'Excalidraw Storage Backend is running',
    version: '1.0.0',
    storage_count: storage.size
  });
};

app.get('/', healthCheck);  // 根路径
app.get('/storage-backend/', healthCheck);  // Caddy 转发路径
app.get('/api/v2/', healthCheck);  // 原始 API 路径

// POST 保存画板数据 - 支持多个路径
const saveScene = (req, res) => {
  try {
    const id = uuidv4();
    const data = {
      id,
      elements: req.body.elements || [],
      appState: req.body.appState || {},
      files: req.body.files || {},
      created: new Date().toISOString(),
      version: req.body.version || 2
    };

    // 存储数据
    storage.set(id, data);

    console.log(`💾 Saved scene ${id}, elements: ${data.elements.length}, size: ${JSON.stringify(data).length} bytes`);

    // 返回符合 Excalidraw 期望的响应格式
    res.json({
      id: id,
      url: `${req.protocol}://${req.get('host')}/api/v2/${id}`
    });

  } catch (error) {
    console.error('❌ Error saving scene:', error);
    res.status(500).json({
      error: 'Failed to save scene',
      message: error.message
    });
  }
};

// POST /api/v2/post/ - 保存画板数据（Excalidraw 分享功能使用的端点）
app.post('/api/v2/post/', saveScene);
app.post('/storage-backend/api/v2/post/', saveScene);  // Caddy 转发路径

// GET 获取画板数据 - 支持多个路径
const getScene = (req, res) => {
  try {
    const { id } = req.params;
    const data = storage.get(id);

    if (!data) {
      console.log(`❓ Scene not found: ${id}`);
      return res.status(404).json({ error: 'Scene not found' });
    }

    console.log(`📖 Retrieved scene ${id}, elements: ${data.elements.length}`);

    // 返回画板数据（不包含元数据）
    res.json({
      elements: data.elements,
      appState: data.appState,
      files: data.files,
      version: data.version
    });

  } catch (error) {
    console.error('❌ Error retrieving scene:', error);
    res.status(500).json({
      error: 'Failed to retrieve scene',
      message: error.message
    });
  }
};

// GET /api/v2/:id - 获取画板数据
app.get('/api/v2/:id', getScene);
app.get('/storage-backend/api/v2/:id', getScene);  // Caddy 转发路径

// 获取存储统计信息（调试用）
app.get('/api/v2/stats', (req, res) => {
  const stats = {
    total_scenes: storage.size,
    memory_usage: process.memoryUsage(),
    uptime: process.uptime(),
    scenes: Array.from(storage.entries()).map(([id, data]) => ({
      id,
      created: data.created,
      elements_count: data.elements.length,
      files_count: Object.keys(data.files).length,
      size: JSON.stringify(data).length
    }))
  };

  res.json(stats);
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 处理
app.use((req, res) => {
  console.log(`❓ Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
  console.log('🚀 Excalidraw Storage Backend started');
  console.log(`📍 Port: ${port}`);
  console.log(`🔗 Health check: http://localhost:${port}/api/v2/`);
  console.log(`🌐 CORS origin: ${process.env.CORS_ORIGIN || 'https://excalidrawx.duckdns.org'}`);
  console.log('📊 Stats available at: /api/v2/stats');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});