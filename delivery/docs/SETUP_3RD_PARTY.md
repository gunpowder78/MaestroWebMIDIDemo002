# 第三方软件配置指南

为了使 Maestro 的 MIDI 信号能够被您的音乐软件识别，我们需要搭建一套内部虚拟 MIDI 路由。

## 1. 安装 loopMIDI (必选)

Maestro Bridge Server 需要一个“虚拟管道”将 MIDI 发送给其他软件。

1. **下载**: 访问 [Tobias Erichsen 官网](https://www.tobias-erichsen.de/software/loopmidi.html) 下载 loopMIDI。
2. **配置**:
   - 打开 loopMIDI。
   - 点击左下角的 `+` 号添加一个新端口。
   - 建议命名为 `Maestro-Port`。
3. **验证**: 在 `Maestro-Bridge.exe` 运行时，您应该能在端口列表中看到这个名字。

---

## 2. 配置 Max/MSP (示例)

如果您使用 Max/MSP 进行声音渲染：

1. 打开您的 `.maxpat` 文件。
2. 在 `[midiin]` 或 `[notein]` 对象中，双击并选择 `Maestro-Port` 作为输入源。
3. 检查控制台（Max Console）是否收到 MIDI 数据包。

---

## 3. 配置其它 DAW (Ableton / Cubase / Logic 等)

1. 进入软件的 **MIDI Settings / Preferences**。
2. 在 **MIDI Input** 列表中找到 `Maestro-Port`。
3. 将其勾选为 **Track** 和 **Remote** (如果需要)。

---

## 4. 故障排查

- **看不到 loopMIDI 端口？**
  - 请重启 Maestro Bridge Server。
- **软件收到了 MIDI 但没有声音？**
  - 检查您的软件是否分配了音源（VSTi）。
  - 检查 MIDI 通道是否匹配（Maestro 默认使用 Channel 1）。
