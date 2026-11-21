# StoryForge

StoryForge 是一个基于 LLM 的互动故事引擎。

## 快速开始

前提：本机已安装 Claude Code 并用订阅账号登录过（终端运行一次 `claude`）。不需要任何 API Key。

```bash
python run.py        # 或双击「启动 StoryForge.command」
```

首次运行会自动建 `.venv` 并安装依赖，随后打开 http://localhost:47613/ 。

- **AI**：服务端调用本机 `claude` 命令行（订阅账号）。剧情对话和自定义世界默认都用 `sonnet`（谈话更有知识、有文采）；想省订阅额度可设环境变量 `SF_CLAUDE_MODEL=haiku`，自定义世界用 `SF_CLAUDE_BUILD_MODEL` 单独指定。
- **语音**：每个角色一个固定声音（edge-tts，见 `server/voice.py` 的 `ROLE_VOICES`），台词流式生成、逐句朗读，文字与声音同步；玩家开口或发言会立即打断当前播放。
- **常开聆听**：进入旅程自动打开麦克风（页头 🎙 可关），不用按键；本机 Whisper 识别，说完停顿约 0.8 秒自动发送。分辨「角色在说」与「我在说」：浏览器回声消除 + 角色说话时开口需更久并先渐隐音量 + 识别后与角色刚说的台词比对丢弃回声。戴耳机请在设置里打开「我戴了耳机」，可随时插话。
- **头像**：目前用 `assets/` 下的静态头像；以后换数字人时，对接 `SF.ui.setSpeaking(on)`（正在说话的角色）即可。

## 手机使用

手机上的页面只是前端，AI 和语音都在你的电脑上跑，所以**电脑要开机并运行着 `python run.py`**。麦克风要求页面是 **https**，所以不能直接用局域网 `http://192.168.x.x`，推荐 ngrok（与 LearningAgent 同一做法）：

```bash
# 1) 电脑上（务必设口令，否则拿到网址的人都能用你的 Claude 订阅）
SF_ACCESS_CODE=你的口令 python run.py --no-browser
# 2) 另开终端
ngrok http 47613
# 3) 手机浏览器打开 ngrok 给的 https 地址，首次输入口令（会记在手机里）
```

- 首次进入旅程时允许麦克风；之后不用按任何按钮，直接说话。
- 手机外放时喇叭离麦克风很近，**强烈建议戴耳机**，并在设置里打开「我戴了耳机」，这样可以随时插话。
- 用 Safari「分享 → 添加到主屏幕」，会以全屏 App 的方式打开，体验更好。
- 说话期间手机会保持亮屏（锁屏后浏览器会停掉麦克风）。
- iOS 不支持音量渐隐，角色说话时你一开口，角色会直接暂停，确认是你在说才打断。

## 文档

更多详细文档请查看 `docs/` 目录：
*   [系统概览](docs/SYSTEM_OVERVIEW.md)
*   [产品原则](docs/STORYFORGE_PRODUCT_PRINCIPLES.md)
