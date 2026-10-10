# Android Debug WebView 检查

`android-webview.mjs` 仅连接独立包 `com.zhuanz1.diary.debug`，不会连接正式包。
需要 Node 22+、已授权 ADB 设备、已打开的 Debug App；不需要新增 npm 依赖。

```powershell
node scripts/qa/android-webview.mjs
node scripts/qa/android-webview.mjs --eval '({imageCount:document.querySelectorAll("img").length})'
```

默认只输出 URL、标题和按钮名。多设备时设置任务级 `DIARY_ADB_SERIAL`；
非默认 SDK 路径可设置 `DIARY_ADB_PATH` 或 `ANDROID_HOME`。
脚本临时分配 ADB 转发端口，并在完成或失败后移除自己创建的转发。

`--eval` 会在 Debug WebView 执行 JavaScript，可修改 Debug 数据，因此仅用于受控 QA。
执行数据测试前记录原有记录 ID；使用 Service 创建独立测试记录和删除该记录，
不要直接清空 store、删除数据库或触碰正式包。不要输出用户正文、私密图片或完整备份。
图片压力测试只使用专门生成的合成素材，测试后清理自己的记录、附件和共享测试素材。

原生流复制回归测试：

```powershell
cd android
.\gradlew.bat :app:testDebugUnitTest --no-daemon
```

Java 测试不替代 DocumentsProvider 和真机生命周期验证。
