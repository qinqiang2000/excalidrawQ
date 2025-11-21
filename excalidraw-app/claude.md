# Excalidraw-App 架构分析

## 核心架构概览

### 主要文件结构

- **入口**: `index.tsx` - React 应用入口
- **核心**: `App.tsx` - 主应用组件，包含场景初始化和数据管理
- **数据层**:
  - `data/LocalData.ts` - 本地数据存储管理器
  - `data/localStorage.ts` - localStorage 操作封装
  - `data/FileManager.ts` - 文件管理
  - `data/tabSync.ts` - 多标签页同步机制

### 存储架构

- **localStorage**: 存储场景元素和应用状态
  - `STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS`: 画布元素
  - `STORAGE_KEYS.LOCAL_STORAGE_APP_STATE`: 应用状态
- **IndexedDB**: 存储文件数据和库数据
- **内存状态版本控制**: 用于多标签页同步

### 关键机制

#### 1. 自动恢复机制

- **位置**: App.tsx:220 行 `importFromLocalStorage()`
- **触发**: `initializeScene` 函数启动时
- **存储**: 通过 `onChange` 回调 -> `LocalData.save()`
- **防抖**: 300ms 延迟保存到 localStorage

#### 2. 文件上下文处理

- **设计**: 纯状态存储，不保存文件路径等元数据
- **原因**: "画板"模式而非"文档"模式
- **结果**: 文件路径信息只存在于当前会话内存中

### 状态管理

- **状态库**: Jotai
- **存储**: app-jotai.ts 定义状态原子
- **同步**: tabSync.ts 处理跨标签页状态同步

### 关键常量

- `SAVE_TO_LOCAL_STORAGE_TIMEOUT`: 300ms - 防抖保存延迟
- `SYNC_BROWSER_TABS_TIMEOUT`: 50ms - 标签页同步间隔

## 技术要点

- **状态管理**: 使用 Jotai 进行状态管理
- **存储策略**: localStorage + IndexedDB 混合存储
- **同步机制**: 基于时间戳的版本控制同步多标签页
- **防抖保存**: 300ms 延迟批量保存优化性能

## 演示模式 (Presentation)

### 文件结构

- **核心组件**: `presentation/Presentation.tsx` - 全屏演示视图
- **动画逻辑**: `presentation/animation.ts` - 幻灯片过渡动画
- **入口 Action**: `packages/excalidraw/actions/actionPresentation.tsx`
- **状态集成**: `App.tsx` 中 `presentationData` state 和渲染逻辑

### 关键函数 (Presentation.tsx)

- `nextSlide()` - 下一页，最后一页时触发退出
- `prevSlide()` - 上一页
- `renderFrame()` - 帧渲染与动画启动
- `handleKeyDown` (useEffect 内) - ESC/方向键处理
- `handleFullscreenChange` (useEffect 内) - 监听退出全屏，触发 onExit

### 核心机制

- **Frame 排序**: 按 Y 坐标升序 `e1.y - e2.y`
- **最后一页判断**: `frameIndex === frames.length - 1`
- **退出流程**: ESC → `exitFullscreen()` → `fullscreenchange` 事件 → `onExit()` → 恢复原始数据到 localStorage
- **Props**: `onExit` 回调负责恢复 `originalElements/AppState/Files`
