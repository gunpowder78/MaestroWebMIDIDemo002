# 开发日志 - 重大事件备忘

## 2024-12-24: Conducting Mode 默认开关事故

### 事故概述

修改 `useConductingSensor` hook 使 Conducting Mode 默认开启的简单需求，耗费了超过 30 分钟和 10+ 次代码修改才最终解决。

### 需求

将 `CONDUCTING MODE` 开关的默认状态从 OFF 改为 ON。

### 预期工作量

修改一行代码：`useState(false)` → `useState(true)`，5 分钟内完成。

### 实际情况

反复修改代码 10+ 次，每次都以为解决了问题，但真机测试始终显示 OFF。

### 根因分析

#### 直接原因

TypeScript 编译器因 `TS6133: 'xxx' is declared but its value is never read` 错误而失败，但：

1. 终端输出显示了 Vite 的"transforming..."信息，看似构建在进行
2. `exit code: 1` 被忽略
3. Vite 没有生成新的 JS 文件，继续使用旧的缓存产物
4. `npx cap sync` 成功复制了旧的产物到 Android 目录

#### 根本原因

1. **缺少构建验证步骤**: 没有检查构建产物的文件名/哈希是否变化
2. **错误信息解读不当**: 将 TypeScript 警告当作可忽略的信息
3. **过度信任工具链**: 假设 `npm run build` 成功就意味着代码已更新

### 解决方案

1. 修复 TypeScript 错误：将未使用的变量重命名为 `_setHasPermission` 等
2. 重新构建：确认新的 JS 文件名（从 `index-DiwjDjzd.js` 变为 `index-DSe2I2_B.js`）
3. 验证构建产物中包含 `useState(!0)`（即 `useState(true)`）

### 经验教训

#### 必须做（DO）

- ✅ 每次构建后检查 exit code
- ✅ 验证 dist/ 目录下的 JS 文件名是否变化
- ✅ 在 Android assets 目录验证文件是否同步
- ✅ 修复所有 TypeScript 错误，包括"看似无害"的未使用变量警告

#### 禁止做（DON'T）

- ❌ 不要在 TypeScript 有错误时继续部署
- ❌ 不要假设 `npm run build` 显示输出就代表成功
- ❌ 不要连续修改代码多次而不验证中间结果

### 后续改进

1. 创建 `.agent/workflows/capacitor-android-build.md` 标准化构建流程
2. 更新 agent rules 增加构建验证规范
3. 考虑添加 CI/CD 流水线自动验证

### 影响

- 时间损失：约 30 分钟
- 用户体验：多次无效部署测试

### 文档关联

- 工作流规范: `.agent/workflows/capacitor-android-build.md`
- Agent Rules: `C:\Users\hxj\.gemini\GEMINI.md`
