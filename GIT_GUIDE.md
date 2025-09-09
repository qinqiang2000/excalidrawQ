# Git 分支管理指引

## 🌳 分支结构

```
官方仓库 (origin) ← master ← qiang (功能分支)
                            ↓
                    您的仓库 (qiang remote)
```

## 📦 仓库配置

- **origin**: `https://github.com/excalidraw/excalidraw.git` (官方仓库)
- **qiang**: `https://github.com/qinqiang2000/excalidrawQ.git` (您的仓库)

## 🔄 官方功能同步流程

### 1. 同步官方最新代码

```bash
git checkout master
git pull origin master
```

### 2. 合并到功能分支（选择一种方式）

**方式 A: Rebase（推荐，保持线性历史）**

```bash
git checkout qiang
git rebase master
```

**方式 B: Merge（保留分支历史）**

```bash
git checkout qiang
git merge master
```

### 3. 解决冲突（如果有）

```bash
# 修复冲突文件后
git add <冲突文件>
git rebase --continue  # rebase方式
# 或
git commit             # merge方式
```

### 4. 推送更新

```bash
git push qiang qiang --force-with-lease  # rebase后需要force
# 或
git push qiang qiang                     # merge后正常推送
```

## ⚡ 快速同步命令

```bash
# 一键同步脚本
git checkout master && git pull origin master && git checkout qiang && git rebase master
```

## 🛡️ 安全提醒

- 使用 `--force-with-lease` 而不是 `--force` 推送
- 定期备份重要修改
- 同步前确认本地修改已提交

## 📋 冲突处理优先级

1. **优先保留官方逻辑** - 核心功能
2. **保留自定义功能** - 文件关联相关代码
3. **更新配置文件** - package.json 等按官方版本
