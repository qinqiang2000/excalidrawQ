# Excalidraw PWA 版本管理与 About 功能设计方案

## 需求概述

为 Excalidraw PWA 应用添加 About 功能，要求：
1. 显示应用版本号
2. 版本号自动管理（自动递增或其他方式）
3. 尽量不改变 @excalidraw-app/ 内部代码

## 架构分析

### 现有架构
- **框架**: React + TypeScript + Vite
- **UI组件**: 使用 Dialog、MainMenu 等组件系统
- **PWA配置**: 通过 vite-plugin-pwa 实现
- **菜单系统**: MainMenu 组件支持自定义菜单项

### 设计原则
1. **最小侵入性**: 最小化对现有代码的修改
2. **可维护性**: 版本管理自动化，减少手动操作
3. **一致性**: UI风格与现有应用保持一致

## 实现方案

### 1. 版本管理系统

#### 1.1 版本存储结构
```json
// version.json
{
  "version": "1.0.0",
  "buildNumber": 1,
  "lastUpdated": "2024-01-10T10:00:00Z",
  "changelog": {
    "1.0.0": "Initial PWA release with About feature"
  }
}
```

#### 1.2 版本管理脚本
```javascript
// scripts/version-manager.js
const fs = require('fs');
const path = require('path');

class VersionManager {
  constructor() {
    this.versionFile = path.join(__dirname, '../version.json');
    this.loadVersion();
  }

  loadVersion() {
    if (!fs.existsSync(this.versionFile)) {
      this.initializeVersion();
    }
    this.versionData = JSON.parse(fs.readFileSync(this.versionFile, 'utf8'));
  }

  initializeVersion() {
    const initialVersion = {
      version: "1.0.0",
      buildNumber: 1,
      lastUpdated: new Date().toISOString(),
      changelog: {
        "1.0.0": "Initial release"
      }
    };
    fs.writeFileSync(this.versionFile, JSON.stringify(initialVersion, null, 2));
  }

  incrementVersion(type = 'patch') {
    const [major, minor, patch] = this.versionData.version.split('.').map(Number);
    
    switch(type) {
      case 'major':
        this.versionData.version = `${major + 1}.0.0`;
        break;
      case 'minor':
        this.versionData.version = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
      default:
        this.versionData.version = `${major}.${minor}.${patch + 1}`;
    }
    
    this.versionData.buildNumber++;
    this.versionData.lastUpdated = new Date().toISOString();
    this.save();
  }

  save() {
    fs.writeFileSync(this.versionFile, JSON.stringify(this.versionData, null, 2));
  }

  getVersion() {
    return this.versionData;
  }
}

module.exports = VersionManager;
```

#### 1.3 自动化版本更新
在 `package.json` 中添加脚本：
```json
{
  "scripts": {
    "version:patch": "node scripts/version-manager.js patch",
    "version:minor": "node scripts/version-manager.js minor",
    "version:major": "node scripts/version-manager.js major",
    "prebuild": "node scripts/version-manager.js patch"
  }
}
```

### 2. About 对话框组件

#### 2.1 组件设计
```typescript
// excalidraw-app/components/AboutDialog.tsx
import React from "react";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { VERSION_INFO } from "../version-info";

interface AboutDialogProps {
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ onClose }) => {
  return (
    <Dialog
      onCloseRequest={onClose}
      title="About Qiang Whiteboard"
      size="small"
    >
      <div className="AboutDialog">
        <div className="AboutDialog__logo">
          {/* Logo */}
        </div>
        
        <div className="AboutDialog__info">
          <h3>Qiang Whiteboard</h3>
          <p>Version: {VERSION_INFO.version}</p>
          <p>Build: #{VERSION_INFO.buildNumber}</p>
          <p>Updated: {new Date(VERSION_INFO.lastUpdated).toLocaleDateString()}</p>
        </div>
        
        <div className="AboutDialog__details">
          <p>Based on Excalidraw</p>
          <p>A whiteboard tool for sketching hand-drawn like diagrams</p>
        </div>
        
        <div className="AboutDialog__links">
          <a href="https://excalidrawq.duckdns.org" target="_blank">
            Visit Website
          </a>
        </div>
      </div>
    </Dialog>
  );
};
```

### 3. 集成到主菜单

#### 3.1 菜单项添加
在 `AppMainMenu.tsx` 中添加：
```typescript
// 在 MainMenu 组件中添加
<MainMenu.Separator />
<MainMenu.Item
  icon={infoIcon}
  onClick={() => props.onAboutDialogOpen()}
>
  About
</MainMenu.Item>
```

#### 3.2 状态管理
在 `App.tsx` 中添加：
```typescript
const [showAboutDialog, setShowAboutDialog] = useState(false);

// 在渲染中添加
{showAboutDialog && (
  <AboutDialog onClose={() => setShowAboutDialog(false)} />
)}
```

### 4. 构建时版本注入

#### 4.1 Vite 配置
```typescript
// vite.config.mts
import versionInfo from './version.json';

export default defineConfig({
  define: {
    '__APP_VERSION__': JSON.stringify(versionInfo.version),
    '__BUILD_NUMBER__': JSON.stringify(versionInfo.buildNumber),
    '__BUILD_TIME__': JSON.stringify(versionInfo.lastUpdated),
  }
});
```

#### 4.2 TypeScript 类型定义
```typescript
// excalidraw-app/version-info.ts
export const VERSION_INFO = {
  version: __APP_VERSION__,
  buildNumber: __BUILD_NUMBER__,
  lastUpdated: __BUILD_TIME__,
};

// 在 vite-env.d.ts 中添加
declare const __APP_VERSION__: string;
declare const __BUILD_NUMBER__: string;
declare const __BUILD_TIME__: string;
```

## 实施步骤

### 第一阶段：版本管理基础
1. 创建 `version.json` 文件
2. 实现版本管理脚本
3. 配置构建脚本集成

### 第二阶段：UI 组件开发
1. 创建 AboutDialog 组件
2. 添加样式文件
3. 集成图标资源

### 第三阶段：系统集成
1. 修改 AppMainMenu 添加菜单项
2. 在 App.tsx 中添加状态管理
3. 配置 Vite 构建注入

### 第四阶段：测试与优化
1. 本地测试功能
2. PWA 构建测试
3. 版本自动更新测试

## 版本策略

### 版本号规则
- **Major**: 重大功能更新或架构变更
- **Minor**: 新功能添加
- **Patch**: Bug 修复和小改进

### 自动化策略
- 每次构建自动递增 patch 版本
- 手动触发 minor/major 版本更新
- Git tag 与版本号同步

## 扩展功能（可选）

### 1. 更新检查
- 定期检查新版本
- 显示更新提示

### 2. 更新日志
- 在 About 对话框中显示更新日志
- 支持查看历史版本信息

### 3. 系统信息
- 显示浏览器信息
- 显示 PWA 安装状态
- 显示存储使用情况

## 注意事项

1. **缓存管理**: PWA 更新版本后需要清理缓存
2. **版本同步**: 确保 version.json 与 Git tag 同步
3. **构建流程**: 版本更新应在构建前执行
4. **向后兼容**: 版本信息存储格式需考虑扩展性

## 总结

本方案通过外部版本管理系统和最小化的代码修改，实现了 About 功能和版本管理。主要优势：

1. **低侵入性**: 主要通过新增文件实现，对现有代码修改极少
2. **自动化**: 版本号可自动管理，减少人工操作
3. **可扩展**: 便于后续添加更多功能
4. **易维护**: 版本信息集中管理，便于维护

后续可根据实际需求进一步优化和扩展功能。