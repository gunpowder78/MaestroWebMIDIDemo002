---
description: Capacitor Android 构建部署标准流程
---

# Capacitor Android 构建部署标准流程

## 核心原则

**永远不要假设构建成功！必须验证构建产物是否真正更新。**

## 标准流程（必须按顺序执行）

### Step 1: 清理旧产物（可选但推荐）

```powershell
# 如果遇到疑似缓存问题，先清理
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
```

### Step 2: 执行构建并检查退出码

```powershell
npm run build
# 必须确认 exit code 为 0
# 必须确认没有 TypeScript 错误（TS6xxx 等）
```

// turbo

### Step 3: 验证构建产物已更新

```powershell
# 检查 dist/assets/*.js 文件名是否变化
Get-ChildItem dist/assets/*.js | Select-Object Name, LastWriteTime
```

### Step 4: 同步到 Android

```powershell
npx cap sync android
```

// turbo

### Step 5: 验证 Android assets 已更新

```powershell
Get-ChildItem android/app/src/main/assets/public/assets/*.js | Select-Object Name, LastWriteTime
```

### Step 6: Android Studio 部署

- 点击 Run 或 Apply Changes
- 如果行为异常，执行 Build -> Clean Project 后重新 Run

## 常见陷阱

### 陷阱 1: TypeScript 编译警告导致 Vite 使用缓存

- **症状**: `npm run build` 看似成功，但 JS 文件名未变化
- **原因**: TS 有 `noUnusedLocals` 等警告时，编译失败但 Vite 输出了部分信息
- **解决**: 修复所有 TS 错误后重新构建

### 陷阱 2: useCallback/useEffect 闭包陈旧

- **症状**: Hook 内部状态更新但 UI 不响应
- **解决**: 使用 `useRef` 存储最新回调，避免依赖数组复杂化

### 陷阱 3: Android WebView 缓存

- **症状**: 代码已更新但真机行为不变
- **解决**: 清除 App 数据或卸载重装
