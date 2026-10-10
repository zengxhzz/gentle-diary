# 日记 · Gentle Diary

Vue 3 + Capacitor 本地优先日记 App：直接写作、草稿与自动保存、图片排版、搜索、日历、心情、标签、收藏、回收站和完整备份恢复。

## 开发

使用 Node.js 22.12 或以上版本：

```bash
npm ci
npm test
npm run dev
```

Windows 上启动手机可访问的预览：

```bash
npm run dev -- --host 0.0.0.0
```

电脑和 iPhone 连接同一局域网，在 iPhone Safari 打开终端显示的局域网 URL。此方式用于页面和 Web 功能预览；不能替代原生相机、文件分享、WebView 存储和 iOS 真机验证。浏览器预览数据与安装的 App 数据相互独立。

## 无 Mac 构建 iOS IPA

GitHub Actions 提供临时 macOS 构建机器。本仓库的 `Build unsigned iOS IPA` 工作流运行测试、同步 iOS 工程并生成 **未签名真机 IPA**，不需要 Apple 账号、证书或仓库 Secrets。下载产物后使用自己的工具签名，包括嵌入的 frameworks，再安装到设备。

在 GitHub 的 **Actions → Build unsigned iOS IPA → Run workflow** 中手动启动。默认 Release，支持选择 Debug，并可启用 iPhone 模拟器启动检查。推送到 `main` 也会构建。构建成功后在该次运行的 **Artifacts** 下载 `gentle-diary-unsigned-*`，解压得到 `.ipa`。

详细步骤、调试方式和验收边界见 [iOS 构建与调试](docs/IOS_BUILD.md)。Expo Go 运行 React Native / Expo 项目，不能直接运行本项目的 Vue + Capacitor 代码。

## 数据与当前范围

数据保存在当前设备；备份为未加密 JSON。SHA-256 用于校验附件意外损坏，不提供加密。iOS 默认备份导出使用系统分享面板，可选择“存储到文件”，返回分享面板不等于确认文件已经写入，需在目标位置核对。

当前 iOS 工程是移植与测试版本，Android 的历史真机结果不能替代 iOS 验收。尚未实现单篇加密、云同步、语音、天气和位置。
