# Android MIDI 开发日志 (2024-12-24)

## 🎯 项目背景

**项目**: Maestro Web MIDI Demo  
**目标设备**: Huawei P30 Pro (Android 10 / HarmonyOS 2.0.0)  
**里程碑**: 实现移动端与 PC 的 MIDI 通信

---

## ❌ 遭遇的问题

### 问题 1: WebMIDI API 闪退

**现象**: 在 Capacitor WebView 中调用 `navigator.requestMIDIAccess()` 并尝试 `output.send()` 时，App 直接闪退 (Native Crash)。

**排查过程**:

- ✅ 正确配置了 `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION` 权限
- ✅ 尝试使用 `Uint8Array` 替代普通数组作为 MIDI 数据缓冲
- ✅ 在 `MainActivity.java` 中添加了 `WebChromeClient` 以自动授予 MIDI 权限

**诊断结论**: 这是 Huawei WebView (Chromium 内核) 在该设备上的实现缺陷。MIDI 相关的 Native 代码在特定条件下崩溃，无法通过 JavaScript 层面修复。

---

### 问题 2: Native Android MIDI Plugin 失败

**现象**: 编写了自定义 Capacitor 插件调用 `android.media.midi` API，尝试通过原生代码发送 MIDI。

**错误信息**:

```
Binder invocation to an incorrect interface
```

**排查过程**:

- ✅ 正确实现了 `MidiManager.openDevice()` 和 `MidiInputPort.send()`
- ✅ 蓝牙连接状态正常，`MidiDeviceInfo` 正确获取

**诊断结论**: Huawei 对 Android 蓝牙 MIDI 驱动进行了定制化修改，导致标准 `android.media.midi` API 与系统服务不兼容。这是系统级别的问题，无法在应用层解决。

---

## ✅ 最终解决方案: WiFi MIDI Bridge

既然蓝牙层不可靠，我们转向**网络层**进行 MIDI 透传。

### 架构图

```
┌─────────────────────┐      WebSocket (ws://)      ┌─────────────────────┐
│   Android App       │ ◄──────────────────────────► │   Node.js Server    │
│   (Capacitor)       │        Port: 3030            │   (midi-bridge)     │
│                     │                               │                     │
│  useWifiMidiPlayer  │                               │    easymidi → loopMIDI
└─────────────────────┘                               └──────────┬──────────┘
                                                                 │
                                                                 ▼
                                                      ┌─────────────────────┐
                                                      │     Max/MSP         │
                                                      │   (piano.maxpat)    │
                                                      └─────────────────────┘
```

### 实现细节

#### 1. PC 端: Node.js WebSocket Server

**文件**: `midi-bridge-server/server.js`

```javascript
// 核心功能
- WebSocket 监听 3030 端口
- 使用 easymidi 库将收到的 MIDI 消息转发到 loopMIDI 虚拟端口
- 自动发现并连接名为 "Maestro" 的 MIDI 端口
- 支持 Note On/Off, Control Change, Program Change
```

**启动方式**:

```bash
cd midi-bridge-server
npm install
npm start
```

#### 2. Android 端: useWifiMidiPlayer Hook

**文件**: `src/hooks/useWifiMidiPlayer.ts`

```typescript
// 核心功能
- 管理 WebSocket 连接状态 (disconnected/connecting/connected)
- 自动格式化服务器地址 (自动添加 ws:// 和 :3030)
- 通过 sendMidi([status, data1, data2]) 发送原始 MIDI 字节
- 内置 playTick(currentTime) 调度器，根据时间轴播放 MIDI 文件
- 支持 Note On/Off 生命周期管理
```

#### 3. 关键配置

**AndroidManifest.xml**:

```xml
<!-- 允许明文 HTTP/WS 传输 -->
<application
    android:usesCleartextTraffic="true"
    android:networkSecurityConfig="@xml/network_security_config">
```

**network_security_config.xml**:

```xml
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
```

---

## 🔧 修复的其他问题

| 问题                      | 解决方案                                |
| ------------------------- | --------------------------------------- |
| FlywheelButton 点击无响应 | props 传递错误: `onClick` → `onTrigger` |
| Windows 防火墙阻止连接    | 添加入站规则允许 3030 端口              |
| App 无法连接 ws://        | 配置 `usesCleartextTraffic`             |

---

## ✅ 验证结果

| 测试项                         | 状态 |
| ------------------------------ | ---- |
| 手机通过 WiFi 连接电脑         | ✅   |
| 点击 "Ping" 按钮，Max/MSP 发声 | ✅   |
| 惯性飞轮 UI 交互正常           | ✅   |
| MIDI 音符与乐谱同步            | ✅   |

---

## 📚 经验教训

### 1. 设备碎片化是 Android 开发的噩梦

> 在老旧或定制化严重的 Android 设备（如 Huawei HarmonyOS）上，Web 标准 API 不可靠。即使 `navigator.requestMIDIAccess` 返回 Promise 成功，底层实现也可能存在缺陷。

### 2. 网络层是更稳健的 Demo 方案

> 当蓝牙等本地协议出现系统级问题时，通过 WiFi + WebSocket 进行透传是快速可行的替代方案。虽然增加了延迟（<50ms），但对于 Demo 演示完全可接受。

### 3. 永远准备 Plan B

> 技术选型时，不要假设标准 API 在所有设备上都能正常工作。尤其是涉及硬件接口（蓝牙、MIDI、USB）时，设备兼容性测试至关重要。

---

## 📁 相关文件

```
├── midi-bridge-server/
│   ├── server.js           # WebSocket MIDI Bridge 服务
│   └── package.json        # 依赖: ws, easymidi
├── src/
│   └── hooks/
│       └── useWifiMidiPlayer.ts  # WiFi MIDI 播放器 Hook
├── android/
│   └── app/src/main/
│       ├── AndroidManifest.xml   # 权限配置
│       └── res/xml/
│           └── network_security_config.xml
```

---

**记录人**: Agile & Claude (Gemini Pair)  
**日期**: 2024-12-24  
**分支**: `feature/wifi-midi`
