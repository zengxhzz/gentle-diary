# 轻描纸印实装 · 视觉与工程验证

日期：2026-10-07；追加更新 2026-10-08。结论：浏览器与 OPPO 真机基础项通过；发现的旋转布局问题已修复。真正断网、多机型、长文中文组合输入与 TalkBack 尚未验收。

## 范围与依据

用户批准缩小后的六主题效果图并要求实装，同时更新计划文件。选定依据为 [保留的最终图稿](docs/design/light-paper-approved.png)，不采用早期大幅水彩稿。按 Product Design 的图稿实装流程生成独立透明素材、复用现有 Vue 页面，并保存图稿与实际页面同屏对照。本轮不是重做正文或日期 UI。

浏览器使用独立 `http://127.0.0.1:4175/#/` origin；测试只写入图稿中的三行示例，不读取或覆盖私人日记，不连接 Android 正式包。截图尺寸记录为 CSS 视口；文件保留浏览器实际截图像素，不假设设备像素比为 1。

## 同屏对照与实际截图

- [完整对照](docs/design/qa/comparison-all.jpg)：左侧最终六主题图稿，右侧六张真实应用截图，下方云朵页对照；已检查全部主题和底角。
- [首屏对照](docs/design/qa/comparison-full.jpg)、[云朵上半页局部](docs/design/qa/comparison-focus.jpg)。云朵源图按单页宽约 310→390 归一化，仅用于比较，不声称来源与实际视口完全等高。
- 390×844：[云朵](docs/design/qa/cloud-390.jpg)、[植物](docs/design/qa/plant-390.jpg)、[小猫](docs/design/qa/cat-390.jpg)、[纸飞机](docs/design/qa/paper-plane-390.jpg)、[星月](docs/design/qa/moon-390.jpg)、[几何](docs/design/qa/geometry-390.jpg)。
- [设置页](docs/design/qa/settings-390.jpg)、[320px 小屏](docs/design/qa/mobile-320.jpg)、[1024px 桌面](docs/design/qa/desktop-1024.jpg)。
- `docs/design/qa/compare.html` 为本地证据展示文件，不新增应用路由、不进入 Vite 生产入口。

## 视觉保真结论

1. 布局与间距：保留现有页头、日期、正文、52px 添加按钮和纸页布局。所有主题统一左下角，避开添加按钮；装饰层不接受点击，未新增导航或卡片。
2. 字体：沿用现有系统字体栈；图稿生成的中文字形、字号比例与运行环境不完全一致，属于保留既有正文 UI 的明确边界，不引入远程字体追逐生成图文字。
3. 颜色：暖白纸面保留，图案灰绿细线、少量浅鼠尾草/米色填充，实际资源有轻微柔和填色差异；不恢复大面积纹理或写实水彩。
4. 素材：六种分别使用真正带透明像素的 PNG；主体为云与小太阳、细枝叶、蜷卧小猫、纸飞机短轨迹、月与星、拱形与圆。首页和设置复用相同文件，无 SVG 代码近似或额外背景矩形。
5. 内容与状态：图稿与测试均为相同三行示例；实际保存后显示「草稿已保存」，与图稿未保存示意的文字差异是实际状态反馈，未更改业务含义。

## 尺寸与行为证据

| CSS 视口 | 图片盒宽×高 | 左上坐标 | 横向溢出 |
| --- | --- | --- | --- |
| 390×844（六主题） | 64×64px | 20, 756 | 无 |
| 320×844 | 约 57.59×57.59px | 20, 约 762.41 | 无 |
| 1024×900 | 64×64px | 208, 812 | 无 |

尺寸是图片盒而非 PNG 内主体边界，资源透明留白不会扩大占屏比例。390px 添加按钮为 52×52px、位置 318,768，与左侧图案不重叠；桌面锚定纸页左边而不是窗口边缘。

- 六主题依次从设置选择、返回写作页：资源加载成功，三行草稿完整保留。
- 自动轮换、每日一次、排除/重新包含云朵，刷新后选项保留；最后恢复测试 origin 的固定云朵主题。
- 自动保存、路由离开及返回后示例仍保留；不修改原保存流程。
- 设置预览全部加载、选中反馈正常；装饰 `aria-hidden`、空 alt、不可拖动、不产生额外交互焦点。
- 本轮浏览器记录的 error 级控制台日志为空。

## 2026-10-07 实装阶段自动化与构建（历史结果）

- 主题服务与新展示回归：2 文件、27 项通过。
- 全量 `npm test`：19 文件、163 项通过。新测试覆盖 ID 兼容、共享资源、PNG 实际透明度、尺寸边界及 Vue SSR 语义。
- `npm run build`：通过，129 个模块，六张本地素材进入构建。
- `npm exec -- cap sync android`：通过，调用项目现有 cap CLI。
- `android/gradlew.bat assembleDebug --no-daemon`：通过，195 项任务。首次缺少 JAVA_HOME 后定位现有 `D:\java21`，只设置当前命令进程环境并重跑；没有安装 JDK、改系统环境或代理。既有 flatDir / SDK XML 警告保留。
- Debug 产物：`android/app/build/outputs/apk/debug/app-debug.apk`，8,467,201 字节。未安装到手机，不宣称真机结果。

## 未完成与非阻塞风险

- 六张 PNG 总计约 1.45 MB，单页只显示当前主题；设置页加载全部。部分源图分辨率高，未来可做构建期无损尺寸/编码优化，不扩大 UI 图案。此为后续优化，非本轮阻塞项。
- Android 键盘/旋转/大字体、真实中文候选、长文和真正断网已在 2026-10-08 追加验证，见下方最新记录；不同屏幕密度、多输入法和 TalkBack 仍待专项。单台设备证据不能覆盖所有厂商。
- 无 schema migration、无数据删除/重建、无依赖新增、无 Git commit。下一步按 [计划文件](docs/THEME_REDESIGN_PLAN.md) 做真机专项，不自动进入其他功能阶段。

## 2026-10-08 Android 真机追加回归

设备：OPPO PJU110，Android 14，720×1612 原生像素、320 dpi。只覆盖安装 `com.zhuanz1.diary.debug`；正式包、签名和数据不动。采用 ADB 原生输入、系统 UI 和 screencap，不执行 WebView 数据库脚本。

### 发现与修复

- [原横屏问题](docs/design/qa/android/landscape-before-fix.png)：正文焦点仍保留时忽略所有 resize，稳定高度继续沿用竖屏，装饰落在屏幕外。
- `resolveStableViewport` 仅冻结同宽度编辑中的键盘收缩；宽度改变和高度恢复可更新。旋转进入连续 resize 窗口，最后一次事件 300ms 后退出，防止 Android 先旋转再调整 IME 时冻结中间尺寸。
- 旋转后在动画帧中将仍连接且仍有焦点的输入元素滚到可见区域；普通同宽度打字不主动滚动。卸载清理动画帧和定时器。
- 极短视口（≤240 CSS px）隐藏纯装饰，不扩大或修改素材；输入行优先，键盘关闭后恢复同一主题。
- [最终横屏键盘可见输入行](docs/design/qa/android/landscape-keyboard-final.png)、[关闭键盘后装饰恢复](docs/design/qa/android/landscape-dismissed-final.png)、[恢复竖屏及原主题](docs/design/qa/android/final-restored.png)。最终截图直接检查，旋转期间一次 UI hierarchy 返回 null 不作为通过证据。

### 已执行的基础项

- 六主题均实际切换并截取竖屏：[云朵](docs/design/qa/android/cloud-portrait.png)、[植物](docs/design/qa/android/plant-portrait.png)、[小猫](docs/design/qa/android/cat-portrait.png)、[纸飞机](docs/design/qa/android/paper-plane-portrait.png)、[星月](docs/design/qa/android/moon-portrait.png)、[几何](docs/design/qa/android/geometry-portrait.png)。设置预览为 [顶部](docs/design/qa/android/settings-before.png) 与 [滚动后](docs/design/qa/android/settings-scrolled.png)。图案、添加按钮和内容层保持可用。
- 键盘展开/关闭，保持编辑焦点旋转，带键盘旋转及关闭后恢复，最终安装包输入行可见且图案不覆盖文字。
- 系统字号直接 shell 修改被厂商 WRITE_SETTINGS 限制拒绝，未授予权限或降低防护。通过正常系统字体页选「超大」、应用后读取 font_scale=1.6；[实际大字体输入页](docs/design/qa/android/font-large.png) 日期换行，文字与按钮可见。此截图是大字体加竖屏键盘，不声称覆盖大字体横屏长文。
- 字号通过同一 UI 恢复默认，读取 1.0。旋转模式恢复 free，accelerometer_rotation=1、user_rotation=0，原字体家族未改。
- 在原本为空的工作草稿中输入自有 `QA-THEME-20261008`；当前中文 IME 将连字符规范为全角 `－`，不是应用丢字。自动保存后 [Debug 强制停止并重开](docs/design/qa/android/cold-start-sample.png)，17 个字符保留（连字符规范化后匹配）。没有测试完整拼音 composition 序列。
- 仅在确认文本完全匹配自有标记后，通过编辑器全选删除测试文字；原空草稿保留。再次冷启动确认恢复空白，未删除原记录、附件或数据库。测试会使该空草稿产生正常保存 revision，不声称 metadata 完全没变化。
- 最终恢复固定云朵；设备 `/data/local/tmp/diary-theme-qa.png` 与 `.xml` 两个自有临时文件已删除，截图证据保留在工作区。

### 最新工程结果与边界

- 新增稳定视口测试 12 项；全量 **20 文件、175 项通过**。`npm run build` 130 模块通过；`npm exec -- cap sync android` 与 `assembleDebug --no-daemon` 通过，最终 Debug APK 8,511,191 字节并已覆盖安装/复测。
- 本轮没有跑 Release/JUnit/audit，也没有复测相机或文件保存，此前结果只作历史依据。
- 未关闭移动网络或 Wi-Fi；本次冷启动验证本地打包运行与草稿持久化，不冒充真正断网。其余待项：多机型/密度、第三方输入法、中文长组合输入、大字体横屏长文、TalkBack。

## 2026-10-08 最终包输入、断网与持久化收尾

下述记录补齐上节历史待项，不改写上节已经执行的范围。设备仍为 OPPO PJU110 / Android 14，正式包不动，仅覆盖安装独立 Debug 包。

### 中文输入与长文

- 实际搜狗九键输入 64426 形成 `ni'hao` 候选，等待超过自动保存窗口后提交 `你好`；继续形成 `jin'tian'xiang'ji'lu` 候选并等待、提交，最终为 `你好今天想记录`，无首字丢失、重复或候选中断。证据：[第一段候选](docs/design/qa/android/ime-composing.png)、[长候选](docs/design/qa/android/ime-long-composing.png)。该 IME 未提交候选不直接进入正文 DOM，不把本次测试说成全部 composition event 路径已验证。
- 此后生成自有 QA 长文。原生 ASCII key events 被当前中文 IME 部分转成中文/全角字符，因此按实际文本验收，不按预期 ASCII 字节假报。实际 1844 字、13 个换行，SHA-256 为 `DC895512365768C410203A931E1BEBAB1C9EB2229C9E19715E073BC581E7A335`。
- 原长段落在大字体横屏会把段落中心误当作当前输入行；改为 Selection/Range 实际光标位置。最终 font_scale=1.6、编辑器 focused=true，[光标截图](docs/design/qa/android/font-large-long-final.png) 清楚显示末行光标在键盘上方，装饰隐藏；[普通竖屏长文](docs/design/qa/android/long-keyboard-final.png) 末行也在键盘上方且无装饰压正文。中间动画/预修复截图不是验收依据。
- 针对原生 WebView caret 自动平移，在稳定/可见高度差 ≥80px 时隐藏装饰；键盘关闭恢复，不改主题设置或静态素材。

### 真正断网与清理

- 最终安装包关闭移动数据（Wi-Fi 原为 0），检查 `dumpsys connectivity` 无 active default network，然后 force-stop Debug 并冷启动；1844 字实际文本摘要完全匹配。证据：[最终包断网冷启动](docs/design/qa/android/offline-latest-build.png)。移动数据在 finally 中恢复 1，Wi-Fi 0 不变，不改变代理或其他网络配置。
- 升级后和字体/旋转测试后内容仍匹配；只在摘要匹配时全选删除自己的测试文字，保留原工作草稿。再次冷启动确认空白，[最终恢复](docs/design/qa/android/final-finish-restored.png)。正常保存使 updatedAt/revision 增加，不宣称记录字节完全不变。
- 字号通过正常系统 UI 恢复 1.0；旋转 free、accelerometer_rotation=1、user_rotation=0；accessibility_enabled=0 保持不变。仅删除设备上本轮两个自有临时文件 `/data/local/tmp/diary-finish-qa.xml`、`.png`，截图证据保留。

### 保存可靠性与工程结果

- 重现旧生命周期快照覆盖新输入的失败测试后修复；仅修改心情/标签的干净编辑器不落盘也已修复。共用 metadata API 保留较新正文/metadata、失败重试、detached tag 数组；发布和离开路由都等期间的新改动保存后才完成，较新写入失败阻止离开，发布后写入保持正式记录。首页发布期间禁止交互，历史编辑页显示错误。
- 相关 3 文件 47 项通过；全量 **21 文件 204 项**通过；Vite build 131 模块、Capacitor sync、Debug/未签名 Release 构建通过。原生 JUnit 7 项通过（备份流复制 6 项），npm audit 0 项漏洞。
- 长文/大字体/中文证据来自本次第一轮安装包（Debug 8509350 字节、未签名 Release 6935732 字节）。最后只补路由守卫等待后续写入，再跑 204 项测试和构建；最终 Debug 8467201 字节、未签名 Release 6935728 字节。最终包实际 Manifest `allowBackup=false`，新旧备份排除 XML 经资源表定位后检查已打包；不等同于设备间实际备份迁移测试。
- 最终包覆盖安装后确认空草稿保留，用自有 `QA204` 验证设置页往返和真正断网冷启动准确保留；随后仅清除该匹配文字，冷启动再确认空白，[最终包恢复截图](docs/design/qa/android/final-204-restored.png)。最终包签名校验 exit=0，包含当前 `useDiaryEditor-BSwQssx1.js` 资源；不声称两轮都重复了全部大字体长文矩阵。
- 新增保存/视口/光标测试；无依赖、schema 或 migration 改动。构建只在当前命令设置现有 JDK 环境，未改系统配置/代理，未提交 Git。
- 剩余发布门槛：多机型/其他输入法、TalkBack 人工全流程、受控低内存/大图库/第三方文档矩阵、正式签名与原位升级，见 [发布清单](docs/RELEASE_READINESS.md)。本轮未重测相机/文件保存生命周期，历史证据不冒充当前全矩阵通过。

## 2026-10-10 安静写作微调

- 用户反馈常态「草稿已保存」与短暂「正在保存」突兀：移除首页状态行/圆点，持久化仍静默运行；错误反馈不隐藏，历史编辑页不变。
- 390×844：日期线底部 181px 不变，正文 top 250→233px，上移 17px。320×844 正文 top 233px，1024×900 日期线 217px / 正文 top 277px；三尺寸均无横向溢出。
- 使用独立 `127.0.0.1:4177` origin、自有示例文字，未读取私人日记。输入与设置页往返保留文字，无常态状态文字；显式「存为草稿」和「保存到日记」显示固定定位的 2.4 秒反馈，正文 top 始终 233px，正式保存后空白下一篇可继续写。error 级浏览器日志为空。
- 截图：[修改前](docs/design/qa/quiet-writing/before-390.png)、[修改后](docs/design/qa/quiet-writing/after-390.png)、[输入](docs/design/qa/quiet-writing/writing-390.png)、[手动草稿反馈](docs/design/qa/quiet-writing/manual-save-390.png)、[正式保存反馈](docs/design/qa/quiet-writing/published-390.png)、[320px](docs/design/qa/quiet-writing/after-320.png)、[1024px](docs/design/qa/quiet-writing/after-1024.png)。浏览器视口 override 已恢复，临时测试 tab 已关闭。
- 新增 7 项 SSR 展示测试，全量 22 文件 214 项通过；Vite build 131 模块、Capacitor Android sync、Debug 构建通过。新包未安装；不使用历史真机截图冒充本次验证，没有运行 iOS 构建或签名发布。
- 该布局阶段无音效、依赖、schema/migration 或保存逻辑变更；不改代理、不删库、不提交 Git。用户随后取消声音，当前仍为无声音版本。

## 2026-10-10 取消声音

- 按用户最新要求撤去声音实现与设置入口，保留安静写作微调。当前 22 文件 214 项测试通过，生产构建 131 模块通过；没有手机安装或新增真机验收。相关试听素材和辅助脚本移出项目、可恢复，不再作为当前设计依据。

## 2026-10-11 寒蝉半圆体 16px（通过，限浏览器）

- 依据：用户选中的寒蝉半圆体预览 A，原版 ChillRoundM v1.805；[预览全屏](docs/design/qa/typography/reference-full.jpg)、[编辑页](docs/design/qa/typography/today-half-round-16.jpg)、[详情页](docs/design/qa/typography/detail-half-round-16.jpg)、[并列与首行对比](docs/design/qa/typography/comparison.jpg)。仅核对字体，不将预览卡片布局视为新页面设计。
- 比较方法：默认视口 492×672、DPR 1；预览完整截图 477×2279（内容宽度扣除滚动条），实际页 492×672。`docs/design/qa/typography/compare.html` 对原始截图作 CSS 视窗裁切，不重绘字形；首行以原始 1:1 像素比较，组合截图 1265×935。预览窄卡片与现有页面正文宽度不同，换行差异是保留既有布局的明确取舍。
- 字体：使用同一原始文件，浏览器确认编辑和详情 font-family 为 ChillRoundM，16px、400、33.6px 行高；编辑字距 0.4px。日期/控件保留原字体，占位、时间线与草稿摘要使用新 token。
- 布局：正文起点仍为 233px，日期和按钮未改，无默认视口横向溢出；不将此前 320/390/1024px 或原生大字号结果冒充本次全尺寸回归。
- 颜色：纸页、正文、辅助色沿用既有 tokens，无调色。
- 图像：六主题及附件展示不变，不生成或替换插画。
- 文案：产品文案不变；截图为自有示例文字，独立 `127.0.0.1:4189` origin，不访问用户私人日记。字体源和 SIL OFL 声明见 `src/assets/fonts/README.md`。
- 交互：输入自动保存后进入草稿并返回，文字保留；正式保存成功，历史时间线显示该篇，详情正文一致。实际编辑/详情与摘要样式已检查，error 级日志为空。
- 工程：字体专项 9 项，全量 23 文件 223 项、131 模块构建通过；字体及许可源/产物 SHA-256 相同，无依赖/数据库迁移/保存逻辑改动。
- 结果：本次限定范围内无 P0/P1/P2 视觉问题。非阻塞取舍：原版字体约 6.52 MB，保留预览字形与原始授权信息；示例字形非空不等于完整 Unicode 覆盖，其他字符可回退系统字体。
- 未完成：字体版原生构建、手机键盘/系统大字号及多机型验证。本次未 sync、打包、手机安装、Git 提交或上传；现有 APK/IPA 不含新字体。
