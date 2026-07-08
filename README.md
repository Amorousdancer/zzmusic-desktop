# ZZmusic

ZZmusic 是一个面向 Windows x64 的本地桌面音乐播放器，使用 Electron、React、TypeScript 和 Vite 构建。它专注于本地音频管理和播放，不依赖账号、云同步或联网服务。

## 下载安装

Windows x64 用户可以下载第一版安装包：

[ZZmusic-0.1.0-x64.exe](https://github.com/Amorousdancer/zzmusic-desktop/releases/download/v0.1.0/ZZmusic-0.1.0-x64.exe)

## 功能

- 导入单个或多个本地音频文件
- 扫描文件夹并导入支持的音频
- 播放、暂停、上一首、下一首、进度跳转和音量控制
- 支持播放队列、随机播放、列表循环和单曲循环
- 本地音乐库持久化，重启后保留已导入歌曲
- 歌单创建、重命名、删除，以及歌曲加入/移出歌单
- 导入 `.lrc` 或 `.txt` 歌词文件
- 内置均衡器预设和自定义频段调节
- 窗口最小化后的悬浮迷你播放器
- 全局快捷键控制上一首、下一首和音量

## 支持格式

当前优先支持：

- `mp3`
- `wav`
- `flac`
- `m4a`

实际播放能力以 Windows 上 Electron/Chromium 的音频解码支持为准。

## 技术栈

- Electron
- React
- TypeScript
- Vite
- electron-vite
- electron-builder
- lucide-react

## 开发环境

建议使用 Node.js 22 或更新版本。

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

类型检查并构建：

```bash
npm run build
```

打包 Windows x64 安装包：

```bash
npm run dist:win:x64
```

生成 Windows x64 未安装目录包：

```bash
npm run pack:win:x64
```

也可以在 Windows 上双击 `ZZmusic.bat`。如果已经存在构建产物，它会尝试启动构建后的应用；否则进入开发模式。

## 数据保存

应用使用 Electron 的 `app.getPath("userData")` 目录保存本地数据，主要包括：

- `library.json`：音乐库
- `playlists.json`：歌单
- `lyrics.json`：歌词

从应用里移除歌曲只会更新音乐库或歌单记录，不会删除磁盘上的原始音频文件。

## 项目结构

```text
.
├── electron/              # Electron 主进程与 preload
├── src/renderer/          # React 渲染进程
├── docs/                  # 需求、方案、设计和验收文档
├── 图标素材/              # 应用图标
├── 视频素材/              # 界面背景视频素材
├── ZZmusic.bat            # Windows 快捷启动脚本
├── electron.vite.config.ts
└── package.json
```

## 快捷键

- `Ctrl + Left`：上一首
- `Ctrl + Right`：下一首
- `Ctrl + Up`：音量增加
- `Ctrl + Down`：音量降低

## 说明

这是一个本地优先的桌面播放器项目。当前版本不包含账号、云同步、联网曲库、封面解析或系统托盘等能力。
