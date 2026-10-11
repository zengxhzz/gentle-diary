# iOS 未签名 IPA 构建与调试

最新字体版已上传并通过第 4 次构建，包含寒蝉半圆体 16px；第 3 次运行保留为不含新字体的历史记录。所有 IPA 均未签名，尚无 iPhone 真机安装验收。

## 最新字体版构建（2026-10-11 / build 4）

- 按用户要求提交并上传字体版本，构建提交：`10abe6cae9a66c20dafb147adaf6f366f4fcdd6a`。
- 本地 23 文件、223 项测试及 Vite 131 模块构建再次通过；[Actions 第 4 次运行](https://github.com/zengxhzz/gentle-diary/actions/runs/38146350838)全部通过，包括云端测试、Web 构建、iOS sync、plist 检查、Xcode 16.4 Release archive、IPA 上传及 iPhone 模拟器启动检查。
- 下载至 `build/ios/run-4/gentle-diary-0.1.0-Release-4-unsigned.ipa`，5,710,319 字节；版本 0.1.0 / build 4，Bundle ID `com.zhuanz1.diary`。
- SHA-256：`B64DDEFBE47DA90C79951C36FA8D894AAAE587DD6657457509CB55FDE76DAE3A`，与云端 `SHA256SUMS.txt` 一致；`build-info.txt` 的构建提交、版本、配置及 Xcode 版本已核对。
- IPA 中字体为 `public/assets/ChillRoundM-DcZcyxmz.ttf`，6,515,060 字节，SHA-256 与选定原版一致；完整 OFL 许可摘要也与源文件一致。包内 CSS 确认本地 @font-face 与 1rem 正文 token；可执行文件、Info.plist、PrivacyInfo、Web 入口及 7 个嵌入 frameworks 存在。
- 日志与截图下载至 `build/ios/run-4-diagnostics/`；日志含 `ARCHIVE SUCCEEDED` / `BUILD SUCCEEDED` 与 App 启动进程。人工查看[字体版模拟器启动截图](design/qa/ios/2026-10-11-font-simulator-startup.png)：首页、圆润占位字形及键盘显示，无白屏；并未输入正文或执行功能矩阵。Filesystem 上游未使用变量、AppIntents 元数据跳过和 Pods 脚本 outputs 警告保留，未阻止构建，不在本次升级依赖掩盖它们。
- 模拟器启动检查不等于 iPhone 真机输入、系统字号、相机、备份和低内存流程验收。安装前必须重新签名 App 及所有嵌入 frameworks；本次不接触签名材料或手机私人数据。
- Git 初始 HTTPS 连接失败后，通过仅对命令设置 `http.sslBackend=openssl`、`http.version=HTTP/1.1` 成功普通快进推送；未强推、修改系统/仓库代理或网络配置。临时下载辅助脚本、产物与日志位于忽略的 `build/`，不上传。

## 历史构建记录（2026-10-11 / build 3）

- 目标：上传现有项目及设计/验收文档，由既有 GitHub Actions 构建当前版本未签名 IPA。
- 本地验证：22 个测试文件、214 项测试通过；Vite 生产构建 131 模块通过。
- 不修改应用功能、依赖、数据库或历史迁移；不上传签名材料、私人备份、个人照片或构建缓存。
- 已上传构建提交：`fbef477aa984ca3cdde27dad17e14060a7e971a7`。
- [Actions 第 3 次运行](https://github.com/zengxhzz/gentle-diary/actions/runs/38068796605)全部通过：云端测试、Web 构建、iOS sync、plist 检查、Xcode 16.4 真机 archive、IPA 上传及 iPhone 模拟器启动检查。
- 下载产物：`gentle-diary-unsigned-Release-3`；IPA 文件为 `gentle-diary-0.1.0-Release-3-unsigned.ipa`，2,176,723 字节，已保存至本地 `build/ios/run-3/`（构建目录不进入 Git）。
- IPA SHA-256：`B4E781AF28D13021BF829EE6AE668242B28C8364E74C4A362267096ABCB408D6`，与云端 `SHA256SUMS.txt` 一致。`build-info.txt` 对应上述提交、Release、版本 0.1.0 / build 3、Bundle ID `com.zhuanz1.diary`。
- 检查 IPA 包含可执行文件、Info.plist、PrivacyInfo、Web 入口及嵌入 frameworks；当前首页静默保存/手动提示代码存在，六张主题 PNG 与本地构建逐字节一致，检查到的 Web 资源引用均可在包中解析。跨系统构建的 JS/CSS 哈希和压缩符号可不同，不声称所有 Web 文件与 Windows dist 逐字节一致。
- 已下载 `ios-diagnostics-3` 到 `build/ios/run-3-diagnostics/`：日志含 `ARCHIVE SUCCEEDED` / `BUILD SUCCEEDED`，模拟器进程启动记录存在；人工查看[启动截图](design/qa/ios/2026-10-11-simulator-startup.png)，首页和键盘正常显示，无白屏。这仅是首次启动证据，不等于正文保存、相机、备份、低内存和真机全流程通过。Pods 构建阶段未声明 outputs 的警告仍保留，未阻止构建。
- 未完成正式签名和 iPhone 真机安装验收。

## Windows + GitHub + iPhone

本地不需要 Mac。GitHub Actions 在临时 macOS 机器上使用 Xcode 和 CocoaPods 编译，输出 `Payload/App.app` 结构的未签名 IPA。构建不登录 Apple、不创建签名身份、不使用 `xcodebuild -exportArchive`。本地签名工具必须支持重新签名 App 和所有嵌入的原生 frameworks；签名证书、描述文件、有效期和设备限制由本地工具处理。

1. 打开仓库的 Actions，选择 **Build unsigned iOS IPA**。
2. 点击 **Run workflow**，选择 Release 或 Debug；可选模拟器启动检查。
3. 等待测试、Web 构建、Capacitor sync 和 Xcode 真机构建完成。
4. 在该次运行下方 Artifacts 下载 `gentle-diary-unsigned-*` ZIP。
5. 解压得到 `.ipa`、`SHA256SUMS.txt` 和 `build-info.txt`。
6. 使用本地工具签名 IPA 并安装到 iPhone。不能直接安装未签名 IPA。

未签名 IPA 产物保留 14 天，日志及模拟器截图保留 7 天；过期后重新运行即可。模拟器检查在 IPA 上传之后执行，因此模拟器检查失败时仍可能已经有可下载的 IPA；必须查看具体步骤状态，不把失败的模拟器检查当作已通过。

不需要填写任何 GitHub Secrets，也不应上传自己的证书、描述文件、私人日记备份或个人照片。公开仓库的源码、构建日志和产物会对其他用户可见。

## 配置

- Capacitor iOS / Core / CLI 当前锁定的实际版本为 7.6.9；依赖由 `package-lock.json` 安装。
- Bundle ID：`com.zhuanz1.diary`。部分签名工具可能更改它；更改后将被系统视为另一个 App，其本地数据可能独立，需通过备份转移。
- 最低系统版本：iOS 14，由 Capacitor 7 工程模板配置。
- iOS version 使用 npm package version，build number 使用 GitHub run number。
- `Info.plist` 声明相机及相册用途；PrivacyInfo 隐私清单声明 Filesystem 文件时间戳 API 的 C617.1 用途并进入 App 资源。
- Android 专用 `BackupDocument` 不在 iOS 调用。iOS 导出通过 Capacitor Share / Filesystem 缓存文件交给系统分享面板，备份源保留 24 小时后按既有清理策略处理。
- Debug / Release 都是 Vite 生产资源构建；选择 Debug 仅改变原生编译配置，并不自动提供远程 JS 调试或热更新。

在 Mac 上也可执行：

```bash
npm ci
npm test
npm run cap:sync:ios
bash scripts/ios/build-unsigned.sh
```

签名后实际支持的系统和权限行为需在目标 iPhone 上验证。模拟器构建产物不能用作真机 IPA。

## 没有 Mac 的调试方式

### 页面与业务逻辑

Windows Chrome / Edge DevTools 检查 Vue 页面、控制台、网络和 IndexedDB。使用 `npm run dev -- --host 0.0.0.0` 可在同一局域网的 iPhone Safari 预览页面、布局和中文输入。它与原生 App 使用不同的运行环境、origin 和数据，不覆盖原生插件验证。

### 云端编译与模拟器

Actions 每次先运行 Vitest；构建失败可直接查看失败步骤日志。`ios-diagnostics-*` 中保留 Xcode 构建日志。启用模拟器检查后，还会在云端 iPhone 模拟器启动 App，保存 `simulator-startup.png`、启动结果和进程记录。

模拟器检查只证明原生程序可启动、截图可抓取和进程在观察时存在；应人工检查是否白屏。它不是远程交互式模拟器，不自动证明正文编辑、权限、离线持久化或备份正常，也不能复现全部真机问题。

### 真机验证

使用签名后的 IPA 在自己的 iPhone 验证：

- 输入中文、长文、换行、横竖屏、键盘打开关闭和大字体。
- 自动保存后返回、切换后台、关闭再打开；核对文字完整。
- 添加相册照片、拍照、拒绝权限后重试、图文排版与缩略图。
- 导出备份到“文件”，在可丢弃测试数据上导入并核对正文和图片。
- 飞行模式冷启动和本地保存。

原生闪退时可以在 iPhone 的“设置 → 隐私与安全性 → 分析与改进 → 分析数据”查找对应 App 的崩溃报告。仅分享与问题相关、经过检查的报告。需要源码行号分析时还需匹配的符号文件，不能把构建日志代替崩溃堆栈。

Safari Web Inspector 的官方远程调试流程需要 Mac 上的 Safari；没有 Mac 时，常规 Windows DevTools 不能直接替代这条真机调试链路。后续如需排查 JS 真机故障，可以另加仅测试版本启用的诊断页；当前版本未添加该功能。

## 验收状态

本文件描述构建与验证方法。工作流绿色、IPA 存在、模拟器启动和 iPhone 功能验收是不同层次的证据；最终状态以对应运行记录与实际设备结果为准。没有完成正式签名、TestFlight 或 App Store 发布。
