# Android Porting Log (Huawei P30 Pro / Android 10)

**Date:** 2025-12-24
**Device:** Huawei P30 Pro (ELLE-AL00)
**OS:** HarmonyOS 2.0 (Android 10 / API 29)
**Status:** UI Layout Perfect (Immersive Mode), Playback Instability (Crash)

## 🏆 核心成就：UI 完美适配方案

经过多轮调试，我们成功解决了 WebView 在特定 Android 机型上的严重视口溢出和缩放问题。以下是“终极方案”的详细总结。

### 1. 视口溢出 (Viewport Overflow)

**问题现象：** 应用内容超出屏幕可视区域，底部控制栏被截断，且伴有橡皮筋滚动效果。
**根本原因：** 华为等部分厂商的 WebView 实现对 CSS `100vh` 或 `100%` 的计算包含系统栏高度，或者与 `window.innerHeight` 不一致。
**解决方案 (JS Force Layout)：**
在 `index.html` 中注入脚本，绕过 CSS 计算，直接用 JS 控制根节点尺寸：

```javascript
function forceLayout() {
  var h = window.innerHeight; // 获取精确的视口像素高度
  var w = window.innerWidth;
  var root = document.getElementById("root");
  root.style.position = "fixed"; // 固定定位防止滚动
  root.style.width = w + "px";
  root.style.height = h + "px";
  root.style.overflow = "hidden";
}
// 监听 resize 和 load，并使用 setInterval 暴力轮询防止键盘弹出破坏布局
```

### 2. 组件高度异常

**问题现象：** 乐谱区域（SheetMusic）把底部 UI 挤出屏幕。
**根本原因：** `SheetMusic.tsx` 曾硬编码高度 `h-[770px]`，在手机屏幕上过高。
**解决方案 (Flex 自适应)：**
我们将高度控制权交给 Flex 布局，让组件填充剩余空间：

```tsx
// Old
<div className="h-[770px] ..."> ❌

// New
<div className="h-full ..."> ✅ (父容器设为 flex-1)
```

### 3. 沉浸式全屏 (Immersive Mode)

**问题现象：** 状态栏和导航栏占用宝贵屏幕空间，且影响视觉沉浸感。
**解决方案 (Native Java)：**
在 `MainActivity.java` 中利用 `View.setSystemUiVisibility` 隐藏系统栏。
**关键点：** 必须在 `onWindowFocusChanged` 中调用，否则应用切换或弹出对话框后会失效。

```java
@Override
public void onWindowFocusChanged(boolean hasFocus) {
    if (hasFocus) hideSystemUI();
}
```

### 4. 权限地狱 (Permission Hell)

**问题现象：** 蓝牙扫描崩溃或无反应。
**根本原因：** Android 版本差异。Android 10 必须有 GPS 权限才能扫蓝牙；Android 12+ 必须有 `BLUETOOTH_SCAN` 权限。
**解决方案 (动态策略)：**

- **Android 12+ (SDK >= 31):** 请求 `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT`。
- **Android 10/11 (SDK < 31):** 请求 `ACCESS_FINE_LOCATION` (GPS)。
- **Manifest:** 同时声明以上所有权限，并添加 `android.hardware.bluetooth` 特性。

---

## ⚠️ 遗留问题 (Known Issues)

### 🔴 点击播放闪退 (Critical)

**现象：** UI 显示正常，但在点击 "Play" 按钮或触发 MIDI 播放时，应用直接闪退（Native Crash）。
**初步诊断：**
极有可能是 **Web MIDI API 在 Android WebView 中的兼容性问题**。
虽然我们在 Manifest 中声明了 MIDI feature，但 WebView 默认可能并不支持通过 JS 直接访问 MIDI 硬件，或者权限被安全策略拦截导致底层崩溃。
**后续计划：**

1. 检查 Logcat 崩溃堆栈（需要在 Android Studio 中连接设备查看）。
2. 考虑使用 Capacitor Community 的 MIDI 插件，而不是原生 Web MIDI API。

---

## 🛠️ 构建经验 (Lessons Learned)

- **Gradle 缓存是魔鬼：** 如果代码修改（特别是 Java 代码或资源文件）在真机上没生效，不要怀疑人生，直接执行 `cd android && ./gradlew clean`。
- **WebView 视口不可信：** 永远不要相信移动端 WebView report 的 CSS 像素高度。JS `window.innerHeight` 是唯一真理。
