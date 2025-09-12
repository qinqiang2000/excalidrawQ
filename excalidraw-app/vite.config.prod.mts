import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgrPlugin from "vite-plugin-svgr";
import { ViteEjsPlugin } from "vite-plugin-ejs";
import { VitePWA } from "vite-plugin-pwa";
import { createHtmlPlugin } from "vite-plugin-html";
import { woff2BrowserPlugin } from "../scripts/woff2/woff2-vite-plugins";

// 生产模式优化配置 - 专用于内存受限环境
export default defineConfig(({ mode }) => {
  const envVars = loadEnv(mode, `../`);
  const disableSourcemap = envVars.VITE_DISABLE_SOURCEMAP === "true";
  
  return {
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    envDir: "../",
    resolve: {
      alias: [
        {
          find: /^@excalidraw\/common$/,
          replacement: path.resolve(
            __dirname,
            "../packages/common/src/index.ts",
          ),
        },
        {
          find: /^@excalidraw\/common\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/common/src/$1"),
        },
        {
          find: /^@excalidraw\/element$/,
          replacement: path.resolve(
            __dirname,
            "../packages/element/src/index.ts",
          ),
        },
        {
          find: /^@excalidraw\/element\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/element/src/$1"),
        },
        {
          find: /^@excalidraw\/excalidraw$/,
          replacement: path.resolve(
            __dirname,
            "../packages/excalidraw/index.tsx",
          ),
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
          replacement: path.resolve(
            __dirname,
            "../packages/utils/src/index.ts",
          ),
        },
        {
          find: /^@excalidraw\/utils\/(.*?)/,
          replacement: path.resolve(__dirname, "../packages/utils/src/$1"),
        },
      ],
    },
    build: {
      outDir: "build",
      // 优化内存使用
      minify: "esbuild", // 使用更快的 esbuild 压缩
      rollupOptions: {
        output: {
          assetFileNames(chunkInfo) {
            if (chunkInfo?.name?.endsWith(".woff2")) {
              const family = chunkInfo.name.split("-")[0];
              return `fonts/${family}/[name][extname]`;
            }
            return "assets/[name]-[hash][extname]";
          },
          // 简化 chunk 分割策略以减少内存使用
          manualChunks: {
            vendor: ['react', 'react-dom'],
            excalidraw: [
              '@excalidraw/excalidraw',
              '@excalidraw/common',
              '@excalidraw/element',
              '@excalidraw/math',
              '@excalidraw/utils'
            ]
          },
        },
        // 减少并行处理以降低内存峰值
        maxParallelFileOps: 2,
      },
      // 条件性禁用 sourcemap
      sourcemap: !disableSourcemap,
      // 减小内联限制
      assetsInlineLimit: 1024, // 只内联小于 1KB 的资源
      // 优化 chunk 大小
      chunkSizeWarningLimit: 1000,
    },
    plugins: [
      woff2BrowserPlugin(),
      react(),
      // 禁用一些不必要的插件以减少内存使用
      svgrPlugin(),
      ViteEjsPlugin(),
      // 简化 PWA 配置
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          globIgnores: [
            "fonts.css",
            "**/locales/**",
            "service-worker.js",
            "**/*.chunk-*.js",
          ],
          // 简化缓存策略
          runtimeCaching: [
            {
              urlPattern: new RegExp(".+.woff2"),
              handler: "CacheFirst",
              options: {
                cacheName: "fonts",
                expiration: {
                  maxEntries: 100, // 减少缓存条目
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
        manifest: {
          short_name: "Excalidraw",
          name: "Excalidraw",
          description: "Excalidraw is a whiteboard tool that lets you easily sketch diagrams.",
          icons: [
            {
              src: "android-chrome-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
          ],
          start_url: "/",
          id: "excalidraw",
          display: "standalone",
          theme_color: "#121212",
          background_color: "#ffffff",
        },
      }),
      createHtmlPlugin({
        minify: true,
      }),
    ],
    publicDir: "../public",
    // 减少开发工具开销
    esbuild: {
      drop: ['console', 'debugger'], // 生产环境移除 console 和 debugger
    },
  };
});