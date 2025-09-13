import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 极简构建配置 - 专门解决内存不足问题
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  envDir: "../",
  resolve: {
    alias: [
      {
        find: /^@excalidraw\/common$/,
        replacement: path.resolve(__dirname, "../packages/common/src/index.ts"),
      },
      {
        find: /^@excalidraw\/common\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/common/src/$1"),
      },
      {
        find: /^@excalidraw\/element$/,
        replacement: path.resolve(__dirname, "../packages/element/src/index.ts"),
      },
      {
        find: /^@excalidraw\/element\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/element/src/$1"),
      },
      {
        find: /^@excalidraw\/excalidraw$/,
        replacement: path.resolve(__dirname, "../packages/excalidraw/index.tsx"),
      },
      {
        find: /^@excalidraw\/excalidraw\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/excalidraw/$1"),
      },
      {
        find: /^@excalidraw\/math$/,
        replacement: path.resolve(__dirname, "../packages/math/src/index.ts"),
      },
      {
        find: /^@excalidraw\/math\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/math/src/$1"),
      },
      {
        find: /^@excalidraw\/utils$/,
        replacement: path.resolve(__dirname, "../packages/utils/src/index.ts"),
      },
      {
        find: /^@excalidraw\/utils\/(.*?)/,
        replacement: path.resolve(__dirname, "../packages/utils/src/$1"),
      },
    ],
  },
  build: {
    outDir: "build",
    // 关键内存优化配置
    minify: false, // 禁用压缩减少内存使用
    sourcemap: false, // 完全禁用 sourcemap
    cssMinify: false, // 禁用 CSS 压缩
    target: "es2020", // 使用现代目标减少转换
    
    rollupOptions: {
      // 减少并行处理
      maxParallelFileOps: 1,
      
      output: {
        // 极简的 chunk 策略
        manualChunks: undefined,
        
        // 禁用所有高级功能以减少内存使用
        assetFileNames: "assets/[name].[ext]",
        chunkFileNames: "assets/[name].js",
        entryFileNames: "assets/[name].js",
        
        // 减少输出选项复杂度
        compact: false,
        
        // 强制小的 chunk 大小
        chunkSizeWarningLimit: 500,
      },
      
      // 减少外部依赖处理
      external: [],
      
      // 简化树摇配置
      treeshake: false,
    },
    
    // 大幅减少资源内联限制
    assetsInlineLimit: 0, // 不内联任何资源
    
    // 禁用实验性功能
    cssCodeSplit: false,
    
    // 强制设置较小的 chunk 警告限制
    chunkSizeWarningLimit: 500,
  },
  
  plugins: [
    // 只保留最必需的插件
    react({
      // 简化 React 插件配置
      jsxRuntime: "automatic",
      babel: false, // 禁用 Babel 以减少内存使用
    }),
    // 移除所有其他插件：PWA、checker、svgr 等
  ],
  
  publicDir: "../public",
  
  // 优化开发服务器以减少内存使用
  server: {
    hmr: false, // 禁用热更新
    watch: null, // 禁用文件监听
  },
  
  // 优化 esbuild 以减少内存使用
  esbuild: {
    target: "es2020",
    logLevel: "error", // 减少日志输出
    legalComments: "none", // 不保留法律注释
    minify: false, // 禁用 esbuild 压缩
    keepNames: false, // 不保留函数名
    drop: ["console", "debugger"], // 移除调试代码
  },
  
  // 禁用实验性功能
  experimental: {
    buildAdvancedBaseOptions: false,
    hmrPartialAccept: false,
  },
  
  // 优化依赖处理
  optimizeDeps: {
    disabled: false,
    include: [], // 不预构建依赖
    exclude: [], // 不排除依赖
  },
});