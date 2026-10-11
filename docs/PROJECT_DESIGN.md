# Project Design

> 本文件是项目的 Single Source of Truth。代码、数据模型、交互原则或架构发生变化时，必须同步更新这里。

最新工程检查（2026-10-11）：当前 23 个测试文件、223 项测试与 131 模块生产构建通过。按用户选定预览内置「寒蝉半圆体」v1.805，日记正文为 16px，日期与控件不变；浏览器核对见 `design-qa.md`。字体版本 `10abe6c` 已上传 `zengxhzz/gentle-diary`，Actions 第 4 次运行 / Xcode 16.4 未签名 Release IPA 及模拟器启动检查通过，IPA 下载及摘要校验完成，确认包含原版字体和许可。尚无 iPhone 真机验收或正式签名，Android 字体包未重建；边界见 [IOS_BUILD.md](IOS_BUILD.md)。本次无依赖、schema、migration 或用户数据改动。

## 1. 项目目标

开发一款可以长期使用的私人日记 App，而不是一次性 Demo。

核心体验是：用户打开 App 后直接看到当天写作页，不需要先选择“新建日记”，也不需要经过 Dashboard、功能菜单或统计页。

第一优先级：

- 写得快
- 看得舒服
- 操作自然
- 数据可靠
- 私密、本地优先
- 长期使用不累
- 后续容易增加能力

当前技术基线：Vue 3、JavaScript、HTML、CSS、Vite、Vue Router、Capacitor，数据结构使用 JSDoc 约束。

## 2. 产品原则

1. 写日记是第一层，其他功能全部后置。
2. Local First。无网络时仍可写、编辑、搜索、查看、删除、恢复和添加本地图片。
3. 内容优先。界面安静，功能需要时出现，不需要时消失。
4. 数据安全优先。升级不能通过清空用户数据库解决。
5. 功能可以多，界面入口必须少。
6. 不为了“看起来功能丰富”增加 Dashboard、统计、Bottom Navigation 或功能入口集合。
7. 所有 Native 能力先经过 Service / Provider 抽象，页面不直接调用插件。

## 3. UI / UX 原则

### 3.1 从设计图保留的视觉语言

- 暖白、米白背景，不使用网页纯白感。
- 深灰绿正文、鼠尾草绿操作色与低饱和莫兰迪主题辅助色。
- 大量留白，正文区域没有明显输入框边框。
- 字号层级清晰：首页突出衬线日期，正文采用本地「寒蝉半圆体」400 字重、默认 16px（1rem）/ 2.1 行高；辅助文字不小于 12px。
- 图标使用细线条，圆角克制。
- 首页只保留极轻量的 `＋`，不常驻一排工具。
- 装饰采用「轻描纸印」灰绿细线与少量淡色，六个主题统一放在纸页左下角；最大 64px，且不超过视口宽度的 18%，避开日期、正文起点和右下角添加按钮，不进入内容层。
- 日记列表采用中等密度时间线，不用每篇一个大 Card。
- 列表缩略图只能是用户为日记添加的真实图片；无图片时不留占位图。

### 3.2 对设计图需要修正或取舍的地方

- 不把“主题选择”做成 App 首屏。App 首屏必须是当天写作页。
- 不把搜索、日历、历史、设置全部展示在首页。它们进入右上角 `···` 的二级入口。
- 不放常驻 Bottom Navigation。
- 图片、拍照、语音、心情、位置、天气、标签只在点击 `＋` 后出现。
- 不逐像素复制插画尺寸。主题装饰只作为轻量 UI 氛围。
- 主题装饰不是用户日记内容，绝不作为日记列表缩略图。
- 设计图中列表卡片感偏重，本项目改为时间线行式结构。
- 设计图中的 AI 生成文字和具体尺寸不作为数据或交互契约。

### 3.3 不可改变规则

1. 打开 App 直接写。
2. 不需要“开始写日记”按钮。
3. 首页没有 Bottom Navigation。
4. 默认只有一个轻量 `＋`。
5. 功能点击 `＋` 后才展开。
6. 主题装饰只占很小面积。
7. 主题装饰不会进入日记列表。
8. 列表图片一定来自用户自己的日记。
9. 无图片日记不显示占位图片。
10. 日记列表采用中等信息密度。
11. 编辑页支持自然图文混排。
12. 图片可以调整大小和位置。
13. 使用受控布局，不做 PPT 式自由画布。
14. 用户数据安全优先。

### 3.4 当前 UI 基线（2026-10-07 重设计）

- 视觉方向为「安静纸页」：暖纸色桌面 `#f3f0e9`、纸页 `#fffcf6`、深灰绿正文 `#34453f`、鼠尾草绿操作色 `#4e6d5c`。桌面内容居中在 44rem 纸页上，手机为无卡片边界的平整纸页。
- 2026-10-11 正文改为用户选定的「寒蝉半圆体」ChillRoundM v1.805，16px / 2.1 / 0.025em；编辑、占位提示、详情、时间线与草稿摘要共用字体 token。保留日期、标题、控件和 caption 的既有字体。原版 TTF 随应用离线打包，附完整 SIL OFL 1.1 与版权声明；`font-display: swap`，未覆盖字符沿既有 sans 字体栈回退。资源增加 6,515,060 字节，不裁字、不改变原字形；字体来源见 `src/assets/fonts/README.md`。
- 首页保留直接写作：顶部是轻量「日记」字标、保存和更多入口；日期以大号日数字搭配年月、星期呈现。2026-10-10 起不再常驻显示「本机草稿 · 自动保存 / 正在保存草稿 / 草稿已保存」，避免每次防抖写入闪烁。正文没有输入框边框，手机起点由日期分隔线下 69px 调整为 52px（390px 测试视口上移 17px），不增加 Dashboard、底部导航或常驻功能排。
- 首页仅显式手动保存草稿/正式日记和相机恢复成功时显示 2.4 秒的非交互轻提示，采用固定定位，不改变正文位置；保存/读取失败继续显示可访问的错误反馈，不把失败静默隐藏。历史编辑页的保存状态不变。650ms 防抖、后台/路由刷新和数据库写入逻辑不变。按用户最新决定保持无声音，不加入音效或震动功能。
- 「＋」展开 2×2 工具面板，只展示已实现的图片、拍照、心情和标签。语音、位置、天气不再显示不可用占位入口，后续阶段实现后再加入。
- 时间线仍采用月份分组和行式结构，30px 衬线日数字、16px 摘要和 80px 真实用户缩略图；没有图片的记录不显示占位图。搜索、日历、草稿和回收站统一标题、空状态和触控尺寸。
- 设置页分为外观、备份与恢复、数据存储，无音效入口。六个主题与首页共用本地「轻描纸印」透明 PNG；导出为主要按钮，导入保留明文风险提示、替换说明、二次确认和原有忙碌/失败反馈。
- 交互控件优先采用 44px 高度；保留安全区、减少动态效果偏好和 Android 编辑时的稳定视口高度。搜索框保留外框焦点提示，并去掉重复的浏览器原生清空按钮；文件输入由按钮触发，不进入独立键盘焦点顺序。
- IndexedDB schema v3、备份 v2/v1、历史 migration 和日记模型不变；650ms 自动保存、相机恢复和附件存储流程保持不变。不为取消功能清理用户数据库，曾写入的可选音效偏好即使存在也不再被读取或执行。

### 3.5 轻描纸印主题基线（2026-10-07）

- 选定图稿是 `docs/design/light-paper-approved.png`，不是早期大面积写实水彩图。执行状态见 [THEME_REDESIGN_PLAN.md](THEME_REDESIGN_PLAN.md)，浏览器视觉核对见根目录 `design-qa.md`。
- 云朵、植物、小猫、纸飞机、星月、几何保留六个既有 ID；同用灰绿线条 `#9EA99C`、淡绿 `#E5E9DE` 与少量米色 `#D9C8AC`，不再按主题改变插画整体色系。
- 每个主题只显示一张透明素材，六张 PNG 随 Vite/Capacitor 打包，首页与设置预览复用，没有远程图源或运行时生成请求。
- 首页图案位于统一左下角，包围盒为 `min(64px, 18vw)` 正方形，原比例 contain；左侧跟随手机 gutter / 桌面纸页 gutter，底部为安全区 + 24px。透明留白使实际图案略小于包围盒，不能通过放大图案展示细节。
- 装饰层保留已有稳定视口高度与 `pointer-events: none`，空 alt、`aria-hidden`、不可拖动，不占正文布局或读屏/键盘焦点，不进入 Block、用户附件备份或时间线缩略图。
- 稳定视口仅冻结同宽度编辑时的键盘收缩，旋转连续 resize 和高度恢复允许更新；旋转后通过 Selection/Range 定位实际光标行，不将长段落中心误当作输入位置。动画帧与 300ms 旋转窗口计时器随页面卸载清理。可见视口高度 ≤240px，或编辑时稳定高度与可见高度相差至少 80px 时临时隐藏装饰，避免 IME 自动平移导致图案覆盖长文；键盘关闭后恢复，主题设置不变。
- 设置页仍从 `DecorationThemeService` 获取 catalog 和保存 ID；固定主题、每日/每次启动轮换和参与集合的行为不变。没有数据库迁移或用户设置重置。

## 4. 当前功能

当前状态：Phase 0～4 与数据安全/Android 稳定性代码已完成。应用具备带 SHA-256 附件校验的完整本地备份 v2（兼容导入 v1）、事务快照导出、原子替换恢复、原生相机恢复、Filesystem 附件镜像、专用缩略图和 caption 编辑。独立 Debug APK 已在 OPPO PJU110（Android 14 / API 34）验证写作、真实拍照、ADB 后台进程回收后的相机结果恢复、Android 系统文件保存和回读，以及三张 6000×4000 合成图片的添加、缩略图、完整备份往返与删除清理。真正由系统低内存自动回收、多机型、长时间/超大图库压力和正式签名升级仍是发布前验证项；厂商相机没有写入像素时只能明确提示重拍。

此前稳定性验证（2026-10-07）：18 个 Vitest 文件、139 项测试通过；原生流复制 6 项 JUnit 测试通过；Vite build、Capacitor sync、Debug 与未签名 Release 构建通过；npm audit 为 0 项漏洞。系统保存窗口前台时用 ADB 回收 Debug 进程，返回后完成文件保存、原图/缩略图摘要核验和设置页恢复反馈。正式包未安装或修改。

同日 UI 重设计已完成首页、公共组件和全部现有二级页面，当前视觉基线见 3.4。随后按用户选定效果图实装「轻描纸印」六种小尺寸装饰，见 3.5。2026-10-08 阶段全量 Vitest 为 **21 个文件、204 项通过**；Vite build（131 模块）、Capacitor sync、Debug 和未签名 Release 构建通过，原生 JUnit 为 7 项（其中备份流复制 6 项）通过，npm audit 为 0 项漏洞。独立 Debug 包已在 OPPO PJU110 验证六主题、真实搜狗中文候选输入、1844 字长文、1.6 倍字号横屏光标及真正断网冷启动；修复了慢速保存并发覆盖、离开路由提前完成和仅修改心情/标签不落盘的问题。详细证据见 `design-qa.md`，发布状态见 [RELEASE_READINESS.md](RELEASE_READINESS.md)。多机型、其他输入法、TalkBack 全流程和正式签名升级仍待验收；相机和系统文件保存的生命周期结果仍是此前回归证据，本次未重跑，不宣称已经完成正式发布。

已完成：

2026-10-10 追加状态：从 GitHub `main` 的 `932280f` 同步已有实现（含 iOS 工程与未签名构建工作流），保留本地额外文档/QA 文件并在同步前备份。首页安静写作调整保留；用户随后取消声音，相关实现、入口和试听素材已移出项目，不再作为开发需求。最新 `npm test` **22 文件、214 项通过**，生产构建 131 模块通过。首页布局阶段的 320/390/1024px 浏览器检查、草稿页面往返及手动保存不跳动通过；本轮不安装手机或运行 iOS 构建，不将 2026-10-08 真机结果冒充本次验证。最新 Android 产物以发布清单为准。

- Vue 3 + Vite + Vue Router + Capacitor 工程。
- Android Capacitor 工程位于 `android/`。
- Design Tokens 与移动端安全区适配。
- IndexedDB 本地数据库和 `schemaVersion`。
- Diary / Block / Attachment / Theme 模型定义。
- DiaryRepository、AttachmentRepository、SettingsRepository、BackupRepository 和 IndexedDB StorageProvider。
- DiaryService、DeviceIdentityService、DecorationThemeService。
- 当天日记直接写作，无“新建”按钮。
- 图片可从相册或系统拍照入口加入，独立保存为附件 Blob。
- Block Editor 支持小图左右浮动、中图、大图与文字环绕。
- 图片支持尺寸、自定义 25%～100% 宽度、布局、拖动/上下排序和删除。
- 支持搜索正文、收藏筛选和心情筛选。
- 支持月日历、有日记日期标记和当天列表。
- 日记详情可切换收藏和心情。
- 首页/编辑页可通过＋设置心情和标签，已选心情/标签显示在编辑前台。
- 标签支持创建、选择、删除和搜索筛选。
- 草稿页支持继续编辑和删除草稿。
- Android 图片/拍照使用 Capacitor Camera，Web 端保留 BrowserMediaProvider 回退。
- Android 相机 Activity 被系统回收后，通过 `appRestoredResult` 恢复结果并按 captureId 去重。
- 原生附件通过 Capacitor Filesystem 保存到应用私有目录，同时保留 IndexedDB 可靠副本和 Web 回退。
- 时间线和搜索使用独立缩略图，不直接加载原始大图；详情和编辑仍使用原图。
- 图片 Block 支持 caption 编辑，参与自动保存并在详情页展示。
- 设置页支持导出单一 JSON 完整备份，以及经严格校验、二次确认后的原子替换恢复；Android 默认通过系统“创建文档”保存到用户所选目录，另保留显式分享入口，Web 使用标准下载。
- Android 使用 `android:allowBackup="false"`，并为 Android 12+ 的云备份、设备间传输及旧版系统分别配置全域排除规则，避免明文内容进入未经应用控制的备份。
- 650ms 防抖自动保存为工作草稿，隐藏、离开路由前强制刷新；路由离开时保存失败会留在编辑页并保留未保存文字。仅修改心情/标签/收藏也能立即保存；慢速写入使用脱离响应式的快照，完成时保留较新的正文和 metadata。发布等待后续改动落盘，不把已发布记录写回草稿；发布期间首页临时禁止编辑/重复操作，失败不开始下一篇。
- 显式“存为草稿”保留当前编辑进度，退出应用后再次打开仍可继续。
- 显式“保存到日记”生成独立正式记录，并开始下一篇。
- 同一天允许保存任意多篇日记，不再限制每天一篇。
- 历史日记时间线，按月份分组。
- 日记详情、编辑。
- 软删除、最近删除、恢复、永久删除。
- 六种数据驱动装饰主题定义与主题解析基础。
- 六种「轻描纸印」本地透明装饰统一左下角和尺寸限制，首页与设置页共用，保持既有主题设置/轮换兼容。
- 极简设置页，展示本地存储状态和当前主题。
- 暖纸阅读型 UI、独立日期/保存状态、四格工具面板及统一时间线、搜索、日历、草稿、回收站和备份设置样式。

尚未实现，按后续 Phase 处理：

- 语音、位置和天气的真实操作。
- 单篇加密与附件加密。
- 天气和定位 Provider。
- 语音输入。
- SyncEngine 与 RemoteRepository。
- Android 发布前专项真机验证；尤其是真正的系统低内存回收、更多厂商相机、长时间/超大图库压力、第三方文档提供器及正式签名升级。OPPO 上相机恢复、真实拍照、DocumentsUI 本机备份回读及三张高分辨率合成图的备份往返已通过 Debug 真机验证。

## 5. 系统架构

强制分层：

```text
View
  ↓
Service
  ↓
Repository 接口
  ↓
Local / Remote Repository
  ↓
Provider / Storage
```

页面层不得直接操作 IndexedDB、远端 API、文件系统、原生插件、同步或加密。

当前目录：

```text
src/
├── assets/
├── components/
│   ├── common/
│   ├── diary/
│   ├── editor/
│   └── themes/
├── views/
│   ├── Today/
│   ├── Diaries/
│   ├── DiaryDetail/
│   ├── Calendar/
│   ├── Search/
│   ├── Settings/
│   └── Trash/
├── models/
├── services/
│   ├── diary/
│   ├── device/
│   ├── theme/
│   ├── media/
│   ├── backup/
│   ├── tag/
│   ├── encryption/
│   ├── sync/
│   ├── weather/
│   ├── location/
│   └── speech/
├── repositories/
│   ├── interfaces/
│   ├── local/
│   └── remote/
├── providers/
│   ├── storage/
│   ├── media/
│   └── backup/
│   ├── location/
│   ├── weather/
│   └── speech/
├── database/
│   ├── schemas/
│   └── migrations/
├── router/
├── styles/
├── utils/
├── App.vue
└── main.js

docs/
└── PROJECT_DESIGN.md

android/
└── Capacitor Android 工程
```

依赖装配位于 `src/services/container.js`。页面导入的是已装配 Service，而不是数据库或 Provider。

## 6. 页面结构

路由：

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | TodayView | 当天写作页，App 默认入口 |
| `/diaries` | DiariesView | 历史时间线 |
| `/diaries/:id` | DiaryDetailView | 日记详情 |
| `/diaries/:id/edit` | DiaryEditView | 历史编辑 |
| `/drafts` | DraftsView | 草稿列表、继续编辑和删除 |
| `/search` | SearchView | 正文、标签、心情与收藏筛选 |
| `/calendar` | CalendarView | 月历标记和按日查看 |
| `/trash` | TrashView | 最近删除、恢复、永久删除 |
| `/settings` | SettingsView | 主题、标签与本地备份恢复 |

首页结构：

```text
日期                  保存  ···

可选地点 · 可选天气

此刻，想写点什么……
（无边框正文输入区）

                         ＋
```

首页右上角的 `保存` 打开“存为草稿 / 保存到日记”，`···` 进入历史日记、草稿、搜索、日历、最近删除和设置。

`＋` 当前只展示图片、拍照、心情、标签四个可用入口。原生端图片和拍照使用 Capacitor Camera，Web 端自动回退 BrowserMediaProvider；语音、位置、天气属于后续阶段，不显示不可用占位。每个入口都隐藏在操作面板中，完成后面板关闭。

## 7. 数据模型

### 7.1 Diary

定义位置：`src/models/Diary.js`。

```js
{
  id,
  title,
  blocks: [],
  createdAt,
  updatedAt,
  diaryDate,
  mood,
  tagIds: [],
  favorite,
  draft,
  attachmentIds: [],
  location,
  weather,
  encryption: {
    encrypted: false,
    version: null
  },
  sync: {
    revision: 0,
    deviceId: null,
    lastSyncedAt: null,
    status: 'local-only'
  },
  deletedAt: null
}
```

约束：

- `diaryDate` 使用本地时区 `YYYY-MM-DD`。
- 同一天可以存在任意多篇正式日记；`diaryDate` 不是唯一键。
- `draft: true` 表示当前工作草稿，不显示在历史时间线。
- `draft: false` 表示已保存到日记的独立记录，可单独编辑、删除和恢复。
- 删除使用 `deletedAt`，不做物理删除，除非用户在“最近删除”中选择永久删除。
- `sync.revision` 每次本地保存递增，为未来同步预留。
- `deviceId` 当前由 DeviceIdentityService 生成并持久化。

### 7.2 Block

定义位置：`src/models/Block.js`。

当前支持：

```js
{ id, type: 'paragraph', text }
{ id, type: 'heading', text, level }
{
  id,
  type: 'image',
  attachmentId,
  layout: 'float-left' | 'float-right' | 'center' | 'full',
  size: 'small' | 'medium' | 'large' | 'full',
  widthRatio: number | null,
  aspectRatio: 'original' | '1:1' | '4:3' | '3:4' | '16:9' | 'custom',
  customAspectRatio: number | null,
  caption
}
```

当前 UI 是 paragraph/image Block Editor。图片可一键切换固定比例，也可拖动右下角控制点自由拉伸宽高；自由拉伸会保存 widthRatio 和 customAspectRatio。caption 可直接编辑，并随同 Block 自动保存。

### 7.3 Attachment

定义位置：`src/models/Attachment.js`。

图片、音频、视频和文件都独立存储，禁止 Base64 塞进 Diary JSON。

```js
{
  id,
  diaryId,
  type,
  localUri,
  thumbnailUri,
  remoteUri,
  mimeType,
  thumbnailMimeType,
  fileName,
  width,
  height,
  size,
  thumbnailSize,
  captureId,
  encrypted,
  createdAt,
  deletedAt
}
```

### 7.4 Theme

定义位置：`src/models/Theme.js` 与 `src/services/theme/decorationThemes.js`。

```js
{
  mode: 'fixed' | 'random',
  rotation: 'each_launch' | 'daily',
  fixedThemeId: null,
  enabledThemes: [
    'cloud',
    'plant',
    'cat',
    'paper-plane',
    'moon',
    'geometry'
  ]
}
```

默认固定云朵主题。ThemeService 支持固定主题、每次打开随机、每天随机与参与轮换主题；设置页已接入。

## 8. Block Editor

当前 UI 是轻量 Block Editor。用户仍然只看到自然正文，但段落与图片都以 Block 数据保存。

正文数据始终是 Block 数组，不是单一字符串。当前 Block Editor 在段落内部保留换行；旧 `plainTextToBlocks` 辅助函数的空行分段规则不再代表当前页面输入路径。自动保存时：

1. paragraph 直接编辑文本，图片作为 image block 参与顺序。
2. 编辑时保持已有 Block ID。
3. 新段落和新图片生成新 ID。
4. 自动保存完整 `Diary.blocks` 与 `attachmentIds`。

`useDiaryEditor.updateMetadata()` 统一持久化心情、标签引用和收藏；有意义的 metadata 可保存为空白草稿。页面不再直接修改 diary 后调用只检查正文 dirty 的刷新方法。旧写入完成时比较 detached metadata / Block 快照，保留期间的新输入并安排下一次保存；失败保留改动供重试。发布和离开路由均等待期间的新改动落盘；较新的写入失败时阻止离开。发布后保存保持 `draft: false`。首页发布期间用 inert 禁止正文/页头交互，添加入口禁用，防止重置下一篇时丢失输入；历史编辑页显示保存失败反馈。

Phase 2 已加入图片 Block、float-left / float-right / center / full 布局、small / medium / large / full 尺寸、拖动和上下移动排序。

禁止：

- Word 式复杂富文本。
- 任意绝对坐标。
- 图片覆盖文字。
- 任意旋转。
- 跨段落破坏性布局。

## 9. Attachment

用户图片必须独立存储：

- Diary 只保存 `attachmentIds` 和 `image` Block 的应用关系。
- MediaProvider 只负责选择/拍摄；二进制由 AttachmentDataProvider 管理。
- Web 与兼容副本使用 IndexedDB；Android/iOS 原生端额外写入 Capacitor Filesystem `Directory.Data` 私有目录。
- 列表缩略图只显示该日记 `attachmentIds` 对应的真实用户图片。
- 原图与缩略图分别保存和清理；缩略图最长边 480px，JPEG 质量 0.78。
- 多图日记列表只取首图；详情显示全部图片。
- 没有图片时列表自然保持纯文字，不放默认图、主题图或空位。

受控图片布局第一阶段规划为：

```text
float-left
float-right
center
full
```

安全尺寸：

```text
small
medium
large
full
```

允许自由拉伸宽高、固定比例裁剪、左右位置、对齐方式、段落归属和顺序。仍不使用任意绝对坐标、旋转或图片盖字。

## 10. Theme System

DecorationThemeService 负责：

- 当前主题。
- 固定主题。
- 每次打开随机。
- 每天随机。
- 可参与轮换的主题。

主题定义包含 `id`、`name`、`decorations`（固定素材 `image` URL 与受限 `size`）、`styleVariant` 和配色。「轻描纸印」资源由本地注册表静态导入，场景和设置预览使用同一 URL，不注入 SVG HTML。统一展示位置/尺寸由 `decorationLayout.js` 约束，页面不为主题写分支。新增主题需注册同风格素材并遵守尺寸上限；旧主题 ID 不因视觉重设计变更。

主题装饰只属于 App UI：

- 首页角落。
- 少量辅助色。
- 小型装饰。

禁止将主题装饰作为：

- 日记正文内容。
- 日记列表缩略图。
- 风景占位图。

## 11. Repository

接口位置：`src/repositories/interfaces/`。

当前本地实现：

- `IndexedDbDiaryRepository`
- `IndexedDbAttachmentRepository`
- `IndexedDbSettingsRepository`
- `IndexedDbBackupRepository`：通过 BackupRepository 聚合接口获取一致事务快照、原子替换用户数据；BackupService 不直接依赖 IndexedDB Provider。

Repository 负责持久化读写，不包含产品策略。产品策略位于 Service。

未来远端实现必须放在 `repositories/remote/`，页面和 Service 的调用语义不能因是否联网而分叉。

## 12. Service

当前 Service：

- `DiaryService`：工作草稿读取/保存、正式日记发布、时间线、详情、软删除、恢复、永久删除。
- `AttachmentService`：图片选择、原图/缩略图保存、运行时 URL、Filesystem/IndexedDB 编排和孤儿清理。
- `BackupService`：通过 BackupRepository 获取完整快照、严格校验、Base64/Blob 转换、平台文件交付、原子替换恢复及原生保存状态读取。
- `CameraRecoveryService`：恢复 Android 相机结果、captureId 去重和失败补偿清理。
- `DeviceIdentityService`：稳定 deviceId。
- `DecorationThemeService`：主题设置与当前主题解析。
- `TagService`：标签定义与删除时引用清理。

未来 Service 边界：
- `SearchService`
- `EncryptionService`
- `SyncService` / `SyncEngine`
- `WeatherService`
- `LocationService`
- `SpeechService`

Native 调用链示例：

```text
Vue Page
  ↓
LocationService
  ↓
LocationProvider
  ↓
CapacitorLocationProvider
```

## 13. Storage

当前 Storage：

- 浏览器 / Android WebView IndexedDB。
- 数据库名：`gentle-diary-local`。
- 当前 schemaVersion：`3`。
- Object Stores：
  - `meta`
  - `diaries`
  - `attachments`
  - `attachment_blobs`
  - `thumbnail_blobs`
  - `settings`
- Indices：
  - diaryDate
  - updatedAt
  - deletedAt
  - attachment diaryId

写入前将 Vue reactive proxy 转为纯 JSON 数据，避免 IndexedDB `DataCloneError`。

附件 metadata、原图 Blob 与缩略图 Blob 分开存储，Diary JSON 不包含 Base64 或 Blob。原生端 CapacitorMediaProvider 从系统相机/相册获取图片，Web 端回退 BrowserMediaProvider。IndexedDB 是可靠兼容副本；原生端 CapacitorFilesystemAttachmentProvider 同时把原图和缩略图镜像到应用私有 `Directory.Data`，读取失败、空文件或与 metadata 长度不符时回退 IndexedDB。删除、启动孤儿清理和备份恢复后会同步清理不再引用的镜像文件。Web 文件选择器的 `cancel` 事件会释放隐藏 input 并返回空结果，不创建附件。

备份采用单一 JSON 文件，包含格式版本、schemaVersion、导出时间、应用版本、日记/草稿/Blocks、设置/主题/标签、附件 metadata，以及原图和缩略图的规范 Base64 Data URL。导出先在一个 readonly transaction 中读取五个用户数据 store 的一致快照，事务完成后才执行 Blob 编码和 SHA-256；不把耗时异步工作放入事务。当前导出 v2 为原图和缩略图分别增加摘要，导入仍兼容 v1。所有结构、类型、ID、引用与 v2 摘要均在事务前校验；替换导入由一个 readwrite transaction 清空并重写 store，失败自动回滚，不删除数据库。来源设备的 Filesystem URI 在导入时归一化为 IndexedDB URI。

Web 由 PlatformBackupFileProvider 触发标准下载。Android 默认将 UTF-8 JSON 写入不参与系统备份的私有 `Directory.Data` 操作专用源文件，通过 BackupDocumentPlugin 与 `ACTION_CREATE_DOCUMENT` 写入用户所选位置；每次源文件带独立 UUID，不会覆盖上一操作。JS Provider 和原生插件都拒绝重叠操作。完成状态与清理 pending 上下文在同一 SharedPreferences commit 中记录，随后删除源文件和释放 URI 权限；进程回收后可以从持久源文件重新复制。源文件缺失时不打开或删除可能已完整写入的目标；只有本次已打开但未完成的目标才尽力删除，不能删除时明确提示不要用它恢复。恢复结果持久化，并通过 BackupService 在设置页展示。

显式 Share 仍使用私有 Cache 中的独立文件；分享结束或返回取消并不能证明目标应用已读完，因此至少保留 24 小时后，在后续分享导出或原生启动时按文件名与 mtime 清理。时间未知的缓存不会盲目删除。原生启动还会清理超过 24 小时、非 pending 的专用 Data 源文件及兼容旧版本备份缓存；清理失败不会把已成功保存误报为失败。备份是未加密明文，应保存在可信位置。

## 14. API

当前 Phase 0～4 不依赖远端 API，离线完整可用。

编码时所有远端 API 使用统一结构：

成功：

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {}
}
```

失败：

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "DIARY_NOT_FOUND",
    "message": "Diary not found",
    "details": {}
  },
  "meta": {}
}
```

路径前缀：

```text
/api/v1/
```

错误码必须有稳定 `code`，界面不解析 message 做业务判断。

## 15. Encryption

单篇日记加密属于 Phase 5，使用成熟标准方案，例如 AES-256-GCM。不得自行设计密码算法。

规划中的加密边界：

- 加密：标题、正文 Block 内容、图片说明、搜索索引、可搜索文本。
- 加密：图片附件原文件与缩略图。
- 明文：`id`、`diaryDate`、`createdAt`、`updatedAt`、`deletedAt`、`sync.revision`、`encryption.encrypted`、`encryption.version`。
- 解密后：列表才能显示标题和摘要；解锁前只显示日期与锁定状态。
- 搜索：加密日记只有在当前会话解锁后才进入内存索引，不生成持久化明文索引。

上述明文 metadata 能支持日历、时间线和删除同步，但会暴露“某天存在日记”这一事实。实施 Phase 5 时必须再次确认该隐私权衡。

## 16. Sync

当前状态：Local Only。没有远端 API、没有自动同步。

已预留字段：

- `sync.revision`
- `sync.deviceId`
- `sync.lastSyncedAt`
- `sync.status`
- `updatedAt`
- `deletedAt` tombstone

未来要求：

- SyncService 编排冲突处理，SyncEngine 执行增量同步。
- RemoteRepository 只负责传输，不直接改 UI。
- 删除记录在同步确认前不能物理清除。
- 加密日记上行前保持端到端加密，服务端不持有明文密钥。
- 冲突模型至少区分日记级、Block 级、附件级冲突。

## 17. Migration

第一版即建立迁移机制：

- `src/database/schemas/schema.js`
- `src/database/migrations/index.js`

规则：

1. 已发布 migration 只追加，不修改历史 migration。
2. 每次 schema 变更新增版本号。
3. `meta` 保存当前 `schemaVersion`。
4. 升级失败必须回滚 IndexedDB transaction，不得用“删库重建”掩盖错误。
5. Model normalize 负责兼容缺字段旧数据，Migration 负责结构性变更。

当前 schema：

- Version 1：创建 meta、diaries、attachments、settings 和索引。
- Version 2：新增 attachment_blobs，用于独立保存图片二进制 Blob。
- Version 3：新增 thumbnail_blobs，用于独立保存列表缩略图 Blob。

## 18. Technical Debt

- 当前 Block Editor 专注 paragraph/image，heading 仍缺少完整编辑 UI。
- 标题已在模型中预留，但当前没有单独标题输入交互。
- 主题设置已接入；后续可增加更多主题和节日限定主题。
- 「轻描纸印」透明 PNG 已接入；小图使用高分辨率来源，后续可做无视觉损失的构建期尺寸/编码优化，不能用增大展示尺寸换取细节。
- 单编辑器内的慢速写入/metadata 并发已做快照保护和回归测试；多标签页同时编辑同一日记仍没有跨 context 锁，未来需要 BroadcastChannel 或 revision 检查。
- Filesystem 是 IndexedDB 的性能镜像，不与 IndexedDB 写入处于同一个跨介质事务；失败时安全回退，启动时通过引用清理孤儿文件。
- 缩略图在浏览器不支持 Canvas/createImageBitmap 时允许缺失并保留原图；该环境的列表不会回退加载大图。
- 完整备份当前仅支持“替换现有数据”，尚未实现可解释的冲突合并。
- JSON + Base64 备份在超大图库上会有峰值内存开销；OPPO 三张高分辨率素材生成约 9.3 MB 备份的回归已通过，不等同于超大图库压力。后续可设计流式 ZIP 格式，但不得破坏 v1/v2 导入兼容。
- Android 系统保存使用独立持久源文件、并发保护和恢复状态反馈。其他应用分享仍不能证明接收方完成落盘；私有分享缓存按 24 小时期限延迟清理，界面提示核对目标文件。第三方 DocumentsProvider 的权限撤销、断连或拒绝删除需额外真机验证。
- 相机/相册恢复仅在原图和 Diary Block 都保存后确认消费；待恢复 URI 保存在本地直到确认或 24 小时过期。Android Camera 临时文件在成功提交后删除，零字节与过期文件启动时清理；原生回调失败时尝试拾回已写入的本次照片。若厂商相机只留下零字节文件，无法凭空恢复像素，只能提示重拍；需在更多机型的低内存矩阵验证。
- Debug 构建使用 `.debug` applicationId 后缀与设备上的正式签名包并存；正式 release 签名、升级路径和发布流水线尚未建立。
- HTML5 drag 主要服务桌面；Android 触屏可通过工具栏上移/下移排序。

## 19. Known Issues

- 当前 Block Editor 只提供 paragraph/image 编辑 UI；heading 数据经过 normalize/persist 会保留，但编辑页缺少 heading 展示/编辑。旧 Phase 1 的纯文本转换辅助函数会转成 paragraph，当前页面不使用该路径。
- 正式日记被清空后仍作为已保存记录存在，列表中显示为空日记提示。
- 首页 `＋` 中只展示已可用的图片、拍照、心情和标签；语音、位置和天气尚未实现，也不显示不可用占位入口。
- 备份文件是未加密明文，用户需要自行保存在可信位置；v2 使用 SHA-256 检查图片字节的意外损坏但不提供保密或防篡改认证，旧 v1 无摘要。Android 已设置 `allowBackup=false` 和严格的数据提取排除规则，设备级行为仍需发布前审计。
- OPPO 的相机在后台 App 进程被 `am kill` 后曾一次返回零字节照片，另一次通过 `appRestoredResult` 成功恢复。代码会提示零字节失败，不伪称已保存；仍需验证真正由系统低内存自动回收及其他厂商行为。三张高分辨率素材及系统文件选择器本机保存/回读已验证，长时间/超大图库压力、第三方 DocumentsProvider 中断、系统备份设备级审计和正式签名升级仍待专项验证。

## 20. Next Steps

1. 按 [发布验收清单](RELEASE_READINESS.md) 补齐多机型/密度、其他中文输入法及 TalkBack 全流程；OPPO 的搜狗候选输入、长文、大字体横屏和真正断网冷启动已通过，单机结果不能替代完整矩阵。
2. 在更多 Android 真机执行真正的系统低内存相机恢复、长时间/超大图库压力及第三方文档提供器验证；保持 Debug 与正式包数据隔离。
3. 建立 release 签名、升级安装与发布流水线，并在发布候选包上复核 `allowBackup=false`。
4. 设计未来流式大文件备份格式 v3 与 v1/v2 兼容策略；当前继续使用经过测试的 JSON 替换恢复。
5. 完成上述发布前专项验证后再进入 Phase 5：单篇日记与附件加密，使用成熟密码学方案，不自制算法。


## 21. Design Decisions

### DD-001 Local First

背景：日记的核心价值是随时可写，不能受网络和远端服务影响。

选择方案：IndexedDB 本地数据库 + Repository/Provider 分层。

选择原因：浏览器和 Capacitor WebView 原生支持，离线可靠，后续可接 SyncEngine。

替代方案：一开始使用远端 API、使用 localStorage 保存完整 JSON、引入大型数据库框架。

影响：Phase 1 完全离线；未来同步需要 revision、deviceId 和冲突处理。

### DD-002 Block Content Model

背景：未来需要图文混排，正文不能是单一字符串。

选择方案：Diary.blocks 从一开始就是有序 Block 数组。

选择原因：可以逐步增加图片、音频、引用和上下文块，不需要进行正文格式大迁移。

替代方案：Markdown 单字符串、Contenteditable HTML 字符串、Word 式富文本 JSON。

影响：Phase 1 需要字符串与 Block 的双向映射；必须尽量保持 Block ID 稳定。

### DD-003 Theme Decoration System

背景：主题变化需要长期扩展，但页面不应为每个主题写死逻辑。

选择方案：Theme Registry + DecorationThemeService + 通用 DecorationScene。

选择原因：新增主题只注册定义，符合低干扰和可迭代目标。

替代方案：每个主题一个独立首页组件、远程插画包。

影响：装饰与用户日记图片保持严格隔离。

### DD-004 Controlled Image Layout Model

背景：移动端小屏需要图文混排，但完全自由画布会导致触控、布局、导出和多端同步不可控。

选择方案：Layout enum + Size enum + widthRatio + caption。

选择原因：保留自然排版自由度的同时控制边界。

替代方案：绝对坐标、任意旋转、图片盖文字。

影响：编辑体验更稳定，后续导出和同步更容易。

### DD-005 Soft Delete Tombstone

背景：误删恢复和未来多设备同步都需要删除状态。

选择方案：使用 `deletedAt` 软删除。

选择原因：用户可以恢复，同步可传播 tombstone。

替代方案：立即物理删除。

影响：必须在同步确认后清理 tombstone；永久删除是明确用户行为。

### DD-006 Working Draft and Saved Entry

背景：自动保存必须保护输入，但“有文字自动成为正式日记”会让一次打开只对应一篇记录，也会把未完成内容提前放入历史。

选择方案：输入自动保存为 `draft: true` 的工作草稿；“存为草稿”显式确认当前进度；“保存到日记”把草稿发布为 `draft: false` 的独立正式记录，并开始下一篇。

选择原因：既保证退出/重开后不丢内容，又让正式历史只由用户明确动作产生。

替代方案：只保留手动保存、所有输入直接进入历史、只有一个当天记录。

影响：需要区分最近工作草稿和正式记录；工作草稿不出现在时间线。

### DD-007 Multiple Entries Per Date

背景：用户可能在一天内多次记录独立内容，不能用日期作为唯一键。

选择方案：`diaryDate` 允许重复，每篇日记拥有独立 `id`、`createdAt`、`updatedAt`、revision 和删除状态。

选择原因：支持当天多次写作，同时保证修改、删除、恢复和未来同步都作用于单篇记录。

替代方案：每天一篇并不断追加、在日期下建立子记录但共享日记主键。

影响：Supersedes Phase 1 中“同一天默认只有一篇 active 日记”和恢复日期冲突规则。恢复同日旧日记时不再拦截。
### DD-008 Binary Attachment Blob Storage

背景：首版支持相册和拍照入口，需要把用户图片与 Diary JSON 分离，同时保持 Android WebView 可离线使用。

选择方案：schema v2 新增 `attachment_blobs` Object Store。`attachments` 保存 metadata，`attachment_blobs` 保存 Blob，两者通过同一 IndexedDB transaction 写入。

选择原因：不把 Base64 或 Blob 放进 Diary JSON；浏览器与 WebView 可离线访问；将来可替换为 Capacitor Filesystem Provider。

替代方案：Base64 存 Diary JSON、Data URL、直接把 File 对象放进日记记录、只依赖远端 URL。

影响：IndexedDB 保留可靠二进制副本；schema v3 增加独立缩略图 store，原生端以 Filesystem 私有文件作为性能镜像。永久删除日记时必须同步清理附件。
### DD-009 Native Camera With Browser Fallback

背景：Web file input 的 `capture` 不是强制打开相机的可靠契约，Android 系统可能显示文件选择器。

选择方案：新增 CapacitorMediaProvider；原生平台通过 `@capacitor/camera` 的 CameraSource.Camera / Photos 获取图片，Web 平台回退 BrowserMediaProvider。

选择原因：点击“拍照”后在 Android 上稳定进入系统相机；相册使用原生 Photo Picker；浏览器开发环境仍然可用。

替代方案：始终使用 Web file input、只支持相册、直接在 Vue 页面调用 Camera 插件。

影响：需要维护原生插件版本；Camera 返回的图片先转成 Blob，再进入 AttachmentService，不把 Base64 保存进日记。`@capacitor/app` 的 `appRestoredResult` 已接入，恢复结果通过 captureId 去重；仅在日记写入事务未成功时补偿删除新附件，写入已提交后绝不删除其引用的附件。
### DD-010 Bounded Free Image Stretch

背景：固定尺寸和固定比例满足常见排版，但用户需要更自由地控制图片占用的宽高。

选择方案：保留 size/layout 预设，同时增加右下角自由拉伸控制点，保存 `widthRatio` 与 `customAspectRatio`。

选择原因：宽高可独立调整，但图片仍在正文文档流和受控宽度范围内，不引入绝对坐标、旋转或任意画布。

替代方案：只允许固定档位、让用户输入像素、完整自由画布。

影响：自由拉伸可能改变图片显示比例；用户可点“原始”恢复未拉伸状态，也可使用 1:1、4:3、3:4、16:9 固定比例。
### DD-011 Theme Settings UI

背景：主题解析能力已经存在，但用户没有界面控制固定主题、随机轮换和参与主题。

选择方案：设置页使用“固定主题 / 自动轮换”两态控制；自动轮换内提供“每次打开 / 每天一次”；主题预览网格支持固定选择或多选参与轮换。

选择原因：入口集中在二级设置页，首页继续只展示当前主题；配置逻辑完全交给 DecorationThemeService。

替代方案：把主题选择放回首页、使用下拉框、每套主题单独组件。

影响：主题设置立即持久化；固定主题与随机集合共用主题注册表，后续新增主题无需改页面逻辑。

### DD-012 Retrieval Through Secondary Views

背景：历史列表不能承担全部查找任务，搜索和日历必须可用但不能重新变成首页主导航。

选择方案：搜索和日历放在 Today 右上角菜单的二级路由；首页仍只保留写作和轻量保存入口。

选择原因：符合“写日记是第一层”，同时让用户在有需要时能快速定位过去内容。

替代方案：首页加入搜索框、底部导航、Dashboard 统计页。

影响：搜索和日历共用 DiaryService / DiaryTimeline；收藏和心情作为日记 metadata 参与搜索。

### DD-013 Tags and Draft Management

背景：Phase 4 需要让用户整理内容，但标签和草稿不应重新占用首页主入口。

选择方案：标签通过设置仓储保存标签定义，Diary.tagIds 只存引用；草稿作为 Diary.draft 记录保留在本地，通过草稿二级页管理。

选择原因：保持 Diary 记录稳定，迁移和未来同步不需要把标签定义复制到每篇日记。草稿复用同一 Diary 结构，发布时不需要转换数据。

替代方案：正文保存标签名字符串、草稿使用单独数据结构、首页直接显示草稿列表。

影响：删除标签需要清理日记中的 tagId 引用；草稿可以继续使用编辑器、附件和自动保存。

### DD-014 Portable Full Backup and Atomic Replace Restore

背景：私人、本地优先应用需要用户可控的灾备能力，并且损坏备份不能破坏现有数据库。

选择方案：单一 JSON + 规范 Base64 Data URL；当前 v2 为原图和缩略图分别附加必需的 SHA-256，仍可导入 v1，不改变 schema。导出使用一个 readonly transaction 获取一致快照；导入仅支持显式二次确认的全量替换，事务前完整校验，通过后使用一个 readwrite transaction 替换全部 store。文件交付由 Provider 负责：Web 标准下载，Android 默认用独立私有 Data 源文件 + `ACTION_CREATE_DOCUMENT` 持久化并支持中断恢复，Share 用延迟清理的独立 Cache 文件作为显式备选。JS 和 Native 双层防重复；清理不会覆盖交付结果。

选择原因：JSON 易检查、易测试且不增加压缩依赖；事务失败由 IndexedDB 原子回滚。第一版不提供语义不清晰的自动合并，避免覆盖和重复内容风险。系统文件保存和 URI 权限语义依据 [Android 官方 Storage Access Framework 文档](https://developer.android.com/training/data-storage/shared/documents-files)；Web 取消行为依据 [HTML 文件上传规范](https://html.spec.whatwg.org/multipage/input.html#file-upload-state-(type=file))。

替代方案：删除数据库重建、逐条导入、无校验合并、立即引入 ZIP。

影响：备份文件当前是明文且大图库会产生 Base64 体积和内存开销。SHA-256 仅检查数据完整性，不是加密或带密钥的身份认证；旧 v1 备份因无摘要不能检测等长字节损坏。未来格式升级必须保留对 v1/v2 的明确兼容或迁移路径。

### DD-015 Filesystem Mirror With IndexedDB Fallback

背景：原图全部从 IndexedDB 读取会限制原生端大图性能，但直接迁移并删除旧 Blob 会增加数据丢失风险，且文件系统与 IndexedDB 无法共享同一事务。

选择方案：AttachmentDataProvider 隔离二进制存储。Web 使用 IndexedDbAttachmentDataProvider；原生使用 CapacitorFilesystemAttachmentProvider，在 IndexedDB 成功写入后尽力镜像到应用私有 Directory.Data，读取失败回退 IndexedDB。专用缩略图单独保存；删除和启动清理同时处理 metadata、原图、缩略图和无引用文件。

选择原因：兼容所有既有 IndexedDB 附件，不需要破坏性迁移，并让原生文件失败退化为可恢复的性能问题而非数据丢失。

替代方案：一次性搬迁后删除 IndexedDB Blob、只存 Filesystem、页面直接调用 Filesystem 插件。

影响：原生端会暂时保留双份二进制数据；需要容量治理。备份恢复将 URI 归一化到 IndexedDB，避免来源设备路径污染，并清理不再有 metadata 的镜像文件。

## 22. Change History

### Change 2026-09-10 / Phase 0 + Phase 1 Foundation

#### 目标

建立可以长期迭代的 Android / Web 日记项目基础，并完成“打开 App 即可直接写当天日记”的核心闭环。

#### 修改了什么

- 创建 Vue 3 + Vite + Vue Router + Capacitor 工程。
- 创建 Capacitor Android 平台工程。
- 建立 Design Tokens、暖白背景和移动端安全区布局。
- 建立 Diary、Block、Attachment、Theme 模型。
- 建立 IndexedDB schemaVersion 与 migration。
- 建立 Repository → Provider 本地存储分层。
- 实现 DiaryService、DeviceIdentityService、DecorationThemeService。
- 实现当天直接编辑、自动保存、离开前刷新。
- 实现历史时间线、月份分组、详情、编辑。
- 实现软删除、最近删除、恢复、永久删除。
- 建立六种数据驱动装饰主题注册表。
- 创建 `docs/PROJECT_DESIGN.md`。

#### 涉及文件

- `package.json`
- `vite.config.js`
- `capacitor.config.json`
- `index.html`
- `src/main.js`
- `src/App.vue`
- `src/router/index.js`
- `src/styles/tokens.css`
- `src/styles/base.css`
- `src/models/Diary.js`
- `src/models/Block.js`
- `src/models/Attachment.js`
- `src/models/Theme.js`
- `src/database/schemas/schema.js`
- `src/database/migrations/index.js`
- `src/providers/storage/IndexedDbStorageProvider.js`
- `src/providers/storage/BrowserDeviceIdentityProvider.js`
- `src/repositories/interfaces/*.js`
- `src/repositories/local/*.js`
- `src/services/container.js`
- `src/services/diary/DiaryService.js`
- `src/services/device/DeviceIdentityService.js`
- `src/services/theme/DecorationThemeService.js`
- `src/services/theme/decorationThemes.js`
- `src/views/**`
- `src/components/**`
- `tests/**`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

首页必须直接服务“写日记”这一第一层任务，因此主题、历史、设置全部后置。数据层从一开始采用 Block、Attachment、revision 和 soft delete，是为了避免未来加入图文、加密和同步时重写核心结构。Theme Registry 和 Repository 分层用于控制长期复杂度。

#### 怎么实现

Vue 页面只调用 Service；Service 通过 Repository 访问 IndexedDB Provider。TodayView 首次加载当天 active diary，没有 active 记录时创建内存中的空 Diary；用户输入后 650ms 防抖保存，空记录不污染历史。保存时纯文字转换为 paragraph blocks 并复用已有 ID。删除写 `deletedAt`，恢复时检查同日 active 冲突，永久删除才真正移除记录。

#### 数据影响

- 数据库：新增 `gentle-diary-local`，schemaVersion = 1。
- Model：新增 Diary、Block、Attachment、Theme。
- API：仅定义统一响应约定，未接远端。
- Migration：新增 v1 初始化迁移。
- Encryption：只预留 encryption 字段，Phase 1 未实现加密。
- Sync：只预留 revision、deviceId、lastSyncedAt、status 和 tombstone，Phase 1 未实现同步。

#### 风险

- 未执行 Android APK 构建，因为当前机器没有 Android SDK/local.properties。
- textarea 编辑器只是 Phase 1 的轻量实现。
- 未提供用户数据导出/备份。
- 多标签页并发编辑尚无冲突锁。
- 加密、图片附件和同步尚未实现，不能对外宣称具备这些能力。

#### 测试

- `npm test`：模型、Block、DiaryService、IndexedDB migration/repository 测试通过。
- `npm run build`：Vite production build 通过。
- 浏览器端运行测试：输入、自动保存、历史、详情、编辑、软删除、恢复、永久删除通过。
- 回归修复：Vue reactive proxy 写入 IndexedDB 的 `DataCloneError`，已通过纯 JSON 转换修复并增加回归测试。
- Capacitor：`npx cap add android` 与 `npx cap sync android` 成功。

#### 下一步

进入 Phase 2，建立 AttachmentService / MediaProvider，并以受控布局模型实现图片添加、尺寸、左右位置、文字环绕和排序。

#### 状态

Completed





### Change 2026-09-13 / 工作草稿与同日多篇日记

#### 目标

取消“同一天只能写一篇”的限制。自动保存只维护可恢复的工作草稿，用户显式保存到日记时生成一篇独立记录；每篇正式日记都可以单独修改、删除和恢复。

#### 修改了什么

- 新增“存为草稿”：当前内容自动保存到最近工作草稿，退出应用后重新打开仍可继续。
- 新增“保存到日记”：将当前草稿发布为正式记录，并清空编辑区开始下一篇。
- 同一天允许保存任意多篇独立日记，每篇拥有独立 ID 和 revision。
- 历史编辑改为直接修改对应记录，不影响同一天其他日记。
- 删除、恢复和永久删除按单篇 ID 执行，不再进行同日冲突拦截。
- 修复单行日记在时间线中错误显示“这一页没有留下文字”的问题。
- Today 页增加克制的“保存”入口，保存方式在操作面板中选择。

#### 涉及文件

- `src/services/diary/DiaryService.js`
- `src/repositories/interfaces/DiaryRepository.js`
- `src/repositories/local/IndexedDbDiaryRepository.js`
- `src/composables/useDiaryEditor.js`
- `src/views/Today/TodayView.vue`
- `src/views/DiaryDetail/DiaryEditView.vue`
- `src/views/Trash/TrashView.vue`
- `src/components/common/AppActionSheet.vue`
- `src/components/diary/DiaryTimeline.vue`
- `tests/diary-service.test.js`
- `tests/indexeddb-storage.test.js`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

自动保存与正式保存承担不同责任：自动保存防止内容丢失，正式保存代表用户决定把这一篇放进历史。使用独立 ID 而不是日期唯一键，才能可靠支持一天多次写作、单篇编辑、删除恢复和未来同步。

#### 怎么实现

TodayView 首次加载最近的 `draft: true` 工作草稿；无草稿时创建内存中的空日记。输入后 650ms 自动调用 `saveDraft()`。点击“保存到日记”时调用 `saveAsEntry()` 将同一记录发布为 `draft: false`，随后创建新的空工作草稿。历史编辑调用 `save()` 保留既有 draft 状态并更新同一个 ID。TimeLine 只显示 `draft: false` 的记录，因此同一日期可出现多行。

#### 数据影响

- 数据库：无 schema 结构变化，无需 Migration。
- Model：继续使用已有 `draft` 布尔字段，语义明确为工作草稿/正式记录。
- API：无远端 API 变化。
- Migration：不需要新增版本。
- Encryption：无影响，仍为 Phase 5。
- Sync：同日多篇天然通过独立 ID 和 revision 支持，不需要共享日期主键。

#### 风险

- 当前只恢复最近一份工作草稿，尚未提供多草稿列表。
- 同一毫秒创建的记录在极端情况下排序可能不稳定，测试不依赖该顺序。
- 正式记录被清空后会作为空日记保留在历史中，避免误以为删除。
- 仍缺少自动备份、导出和 Android 真机测试。

#### 测试

- `npm test`：9 个测试通过，覆盖工作草稿恢复、同日多篇、单篇修改、单篇软删除/恢复和 IndexedDB 草稿查询。
- `npm run build`：生产构建通过。
- 浏览器端验证：草稿自动保存后刷新仍存在；同一天连续保存两篇；修改其中一篇；删除、恢复、永久删除其中一篇；另一篇不受影响；控制台无错误。
- 测试日记已从本地数据库永久清理。

#### 下一步

继续 Phase 2 的 AttachmentService / MediaProvider，并在现有独立日记 ID 上实现图片附件、受控布局和图文环绕。

#### 状态

Completed

### Change 2026-09-13 / 修复编辑页无法退出

#### 目标

修复从日记详情切换编辑后，返回按钮造成历史栈循环、用户无法正常退出编辑模式的问题。

#### 修改了什么

- 编辑页返回时优先使用真实历史回退，而不是再 push 一个详情页。
- 直接通过深链进入编辑页且没有可回退历史时，才 replace 到详情页作为兜底。
- 避免“详情 → 编辑 → 详情”堆叠导致 Android/浏览器返回时重新进入编辑页。

#### 涉及文件

- `src/views/DiaryDetail/DiaryEditView.vue`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

原实现从编辑页调用 `router.push(详情)`，编辑页仍留在历史栈中。详情页再返回时会重新进入编辑页，形成循环。正确行为是退出编辑时回退到进入编辑前的详情页。

#### 怎么实现

`DiaryEditView.goBack()` 检查 `window.history.state.back`：存在历史时调用 `router.back()`，否则使用 `router.replace()` 返回详情页。

#### 数据影响

- 数据库：无影响。
- Model：无影响。
- API：无影响。
- Migration：不需要。
- Encryption：无影响。
- Sync：无影响。

#### 风险

- 直接深链打开编辑页时会 replace 到详情页，不保留来源页面。
- Android 硬件返回键仍按 WebView 路由历史处理。

#### 测试

- 浏览器验证：历史 → 详情 → 编辑 → 返回后进入详情。
- 浏览器验证：详情再返回后进入历史列表，不会重新进入编辑页。
- 修改后立即返回时的自动保存仍正常。
- `npm test`：9 个测试通过。
- `npm run build`：生产构建通过。

#### 下一步

将同样的导航栈检查方式复用到后续新增的编辑类页面。

#### 状态

Completed











### Change 2026-09-13 / Phase 2 图片附件与受控排版

#### 目标

让用户可以把真实照片加入日记，图片独立于 Diary JSON 保存，并支持小图左右浮动、中图、大图、尺寸调整和排序。

#### 修改了什么

- 新增 MediaProvider 接口与 BrowserMediaProvider。
- 新增 AttachmentRepository 与 IndexedDbAttachmentRepository。
- 新增 AttachmentService，负责图片选择、metadata/Blob 保存、运行时 Object URL 和清理。
- IndexedDB schema 升级到 v2，新增 `attachment_blobs` Store。
- Diary 保存时根据 image blocks 自动同步 `attachmentIds`。
- 编辑器从 textarea 升级为 Block Editor，支持 paragraph 和 image blocks。
- 图片支持 `float-left / float-right / center / full`。
- 图片支持 `small / medium / large / full`。
- 支持拖动排序和触屏可用的上移/下移按钮。
- 历史时间线显示用户真实首图；纯文字日记仍不显示占位图。
- 详情页渲染完整 Block 和图片布局。
- 编辑日记时可以继续添加、调整和删除图片。
- 永久删除日记时同步清理附件 metadata 与 Blob。
- `＋` 中的图片与拍照入口从“后续开放”改为可用。

#### 涉及文件

- `src/database/schemas/schema.js`
- `src/database/migrations/index.js`
- `src/providers/storage/IndexedDbStorageProvider.js`
- `src/providers/media/MediaProvider.js`
- `src/providers/media/BrowserMediaProvider.js`
- `src/repositories/interfaces/AttachmentRepository.js`
- `src/repositories/local/IndexedDbAttachmentRepository.js`
- `src/services/media/AttachmentService.js`
- `src/services/diary/DiaryService.js`
- `src/services/container.js`
- `src/composables/useDiaryEditor.js`
- `src/components/editor/EditableParagraph.vue`
- `src/components/editor/DiaryBlockEditor.vue`
- `src/components/diary/DiaryBlocks.vue`
- `src/components/diary/DiaryTimeline.vue`
- `src/views/Today/TodayView.vue`
- `src/views/DiaryDetail/DiaryEditView.vue`
- `src/views/DiaryDetail/DiaryDetailView.vue`
- `src/views/Diaries/DiariesView.vue`
- `tests/indexeddb-storage.test.js`
- `tests/diary-service.test.js`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

图片是日记内容，不是主题装饰。把图片作为独立 Attachment 保存，可以避免 Archive JSON 膨胀、减少复制，并为后续加密、Filesystem、同步和缩略图保留扩展点。Block Editor 则让图片成为正文顺序的一部分，而不是独立相册。

#### 怎么实现

BrowserMediaProvider 使用 WebView file input 读取图片，原子写入 `attachments` 与 `attachment_blobs`。AttachmentService 在运行时创建 Object URL。DiaryService 保存时从 image blocks 同步 `attachmentIds`。DiaryBlockEditor 使用 contenteditable paragraph 与图片 Block 混排，float 布局由 CSS 控制的有限宽度实现；工具栏修改 layout、size，拖动或上下按钮调整顺序。永久删除日记时调用 AttachmentService 清理附件。

#### 数据影响

- 数据库：schemaVersion 从 1 升级到 2。
- Model：Attachment 与 ImageBlock 正式投入使用，Diary.attachmentIds 由 blocks 同步。
- API：无远端 API 变化。
- Migration：新增 v2，创建 `attachment_blobs` Object Store。
- Encryption：图片仍是明文 Blob，加密留到 Phase 5。
- Sync：附件 metadata 与 Blob 已分离，但 SyncEngine 尚未实现。

#### 风险

- 原生 Capacitor Camera / Filesystem Provider 尚未接入，当前依赖 WebView file input。
- Blob 存在 IndexedDB，大量高分辨率图片可能快速增加数据库体积。
- 时间线首图使用原图，尚未生成缩略图。
- HTML5 drag 在触屏环境有限，移动端优先使用上移/下移和布局按钮。
- 图片 caption 可保存，但尚无输入 UI。
- 加密、备份和附件同步尚未实现。

#### 测试

- `npm test`：10 个测试通过。
- `npm run build`：生产构建通过。
- 浏览器端验证：相册选择图片、自动保存草稿、左浮小图、正文文字环绕、保存到日记、详情渲染、时间线首图、编辑页恢复布局、退出编辑、永久删除和附件清理。
- 测试图片日记已从本地数据库永久清理。
- 控制台无错误。

#### 下一步

接入 Capacitor Camera / Filesystem 原生 Provider，生成缩略图，增加 caption 编辑，再进入 Phase 3 主题轮换设置界面。

#### 状态

Completed





### Change 2026-09-13 / 修复图片尺寸按钮

#### 目标

修复图片工具栏中的“小 / 中 / 大 / 满”按钮只改变选中状态、不改变图片实际宽度的问题。

#### 修改了什么

- 新建 ImageBlock 不再默认写入固定 `widthRatio: 0.72`。
- 新增统一的尺寸到宽度映射 `getImageWidthRatio()`。
- 点击尺寸按钮时清除旧的自定义宽度覆盖，确保立即按尺寸生效。
- 编辑器与详情页共用同一宽度计算逻辑。
- 增加尺寸宽度回归测试。
- 将尺寸“满”改名为“满宽”，将 layout“大图”改名为“通栏”，避免两组控制混淆。

#### 涉及文件

- `src/models/Block.js`
- `src/components/editor/DiaryBlockEditor.vue`
- `src/components/diary/DiaryBlocks.vue`
- `tests/diary-model.test.js`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

旧逻辑优先使用固定 `widthRatio`，导致 size 字段虽然变化，渲染宽度仍固定为 72%。尺寸档位必须成为默认宽度来源，`widthRatio` 只在未来提供自定义宽度时覆盖。

#### 怎么实现

`getImageWidthRatio()` 按 `small / medium / large / full` 返回 0.32 / 0.52 / 0.72 / 0.88；layout 为 full 时返回 1；存在显式 `widthRatio` 时优先使用显式值。尺寸按钮同时写入 size 并清除旧 widthRatio。

#### 数据影响

- 数据库：无结构变化。
- Model：ImageBlock 的 widthRatio 改为可空。
- API：无影响。
- Migration：不需要。
- Encryption：无影响。
- Sync：无影响。

#### 风险

- 旧的 ImageBlock 如果保存过显式 widthRatio，第一次点击尺寸按钮后会清除该覆盖并改用档位宽度。
- `满` 尺寸与 `大图` layout 有不同职责；大图 layout 始终占满正文宽度。

#### 测试

- `npm test`：11 个测试通过。
- `npm run build`：生产构建通过。
- 浏览器实测图片宽度：小尺寸约 200px，大尺寸约 449px，按钮已真实生效。
- 控制台无错误。
- 测试图片已删除。

#### 下一步

继续 Phase 2 收尾：原生 Camera / Filesystem、缩略图和 caption 编辑。

#### 状态

Completed






### Change 2026-09-14 / 自定义宽度、原生相机与 APK 构建

#### 目标

让图片尺寸可以精细调整，并确保 Android 点击“拍照”时可靠调用系统相机；同时完成第一次真实 Android Debug APK 构建。

#### 修改了什么

- 图片工具栏新增“自定义”宽度。
- 宽度滑杆支持 25%～100%，步进 1%。
- 自定义宽度保存到 ImageBlock `widthRatio`，重新打开后保留。
- 尺寸档位按钮继续提供小 / 中 / 大 / 满宽。
- 位置“大图”改名为“通栏”，尺寸“满”改名为“满宽”。
- 安装 `@capacitor/camera@7.0.5`。
- 新增 CapacitorMediaProvider：原生端使用系统相机/相册，Web 端回退 BrowserMediaProvider。
- 容器改用 CapacitorMediaProvider。
- Android SDK `local.properties` 已配置。
- 成功执行 Gradle `assembleDebug` 并生成 APK。

#### 涉及文件

- `package.json`
- `package-lock.json`
- `src/models/Block.js`
- `src/components/editor/DiaryBlockEditor.vue`
- `src/providers/media/CapacitorMediaProvider.js`
- `src/providers/media/BrowserMediaProvider.js`
- `src/services/container.js`
- `tests/diary-model.test.js`
- `android/local.properties`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

固定档位适合快速排版，但当用户希望图片更窄或更宽时缺少控制。低频、受控的宽度滑杆比任意像素/自由缩放更适合移动端。原生 Camera 则解决 Web `capture` 提示在不同 Android WebView 上行为不一致的问题。

#### 怎么实现

尺寸按钮使用统一 `getImageWidthRatio()`。自定义滑杆写入 `widthRatio`，渲染时优先使用显式值；点击预设尺寸会清除自定义覆盖。原生平台由 CapacitorMediaProvider 调用 `Camera.getPhoto()`，使用 `resultType: Uri`，再把 `webPath` 转成 Blob 交给 AttachmentService。Web 继续使用 file input。

#### 数据影响

- 数据库：无 schema 变化。
- Model：继续使用已有可选 `widthRatio`。
- API：无远端 API 变化。
- Migration：不需要。
- Encryption：图片仍为明文 Blob。
- Sync：无变化。

#### 风险

- Camera Activity 被系统回收时的 `appRestoredResult` 恢复尚未接入。
- Filesystem Provider 尚未接入，照片 Blob 仍存 IndexedDB。
- 大图缩略图尚未生成。
- Android 真机相机权限和厂商相册行为仍需验证。

#### 测试

- `npm test`：11 个测试通过。
- `npm run build`：生产构建通过。
- 浏览器验证：自定义 35% 宽度即时生效。
- `npx cap sync android`：Camera 插件同步成功。
- `.\gradlew.bat assembleDebug --no-daemon`：BUILD SUCCESSFUL。
- APK：`android/app/build/outputs/apk/debug/app-debug.apk`，约 8.66 MB。

#### 下一步

连接 Android 真机验证 Camera / Photos，随后接入 Filesystem、appRestoredResult、缩略图和 caption 编辑。

#### 状态

Completed




### Change 2026-09-14 / 图片自由拉伸与比例预设

#### 目标

允许用户不受固定尺寸档位限制，自由调整图片宽高，同时保留可控的固定比例工具。

#### 修改了什么

- ImageBlock 新增 `aspectRatio` 与 `customAspectRatio`。
- 图片比例支持原始、1:1、4:3、3:4、16:9。
- 图片右上角保留拖动排序，右下角新增自由拉伸控制点。
- 拖动控制点可独立改变图片宽度和高度。
- 自由拉伸使用 widthRatio + customAspectRatio 保存。
- 详情页按保存后的比例渲染。
- 增加自由比例回归测试。

#### 涉及文件

- `src/models/Block.js`
- `src/components/editor/DiaryBlockEditor.vue`
- `src/components/diary/DiaryBlocks.vue`
- `tests/diary-model.test.js`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

固定档位适合快速排版，但无法满足用户对图片占用宽高的精细控制。自由拉伸保留受控文档流，不引入绝对坐标或任意画布。

#### 怎么实现

拖动右下角控制点时读取编辑器宽度、图片初始宽高和指针位移，实时写入 `widthRatio` 与 `customAspectRatio`。固定比例按钮写入 `aspectRatio`，自定义拉伸使用 `aspectRatio: 'custom'`，详情页读取相同字段渲染。

#### 数据影响

- 数据库：无 schema 变化。
- Model：ImageBlock 新增两个可选字段。
- API：无影响。
- Migration：旧图片没有新字段时默认 original。
- Encryption：无影响。
- Sync：字段随 Block 一起同步。

#### 风险

- 自由拉伸允许改变图片原始显示比例。
- 触屏极小尺寸拖拽仍需真机手感验证。
- 未提供撤销/重做。

#### 测试

- `npm test`：12 个测试通过。
- `npm run build`：生产构建通过。
- 浏览器验证：自由拉伸后宽度 324→393px、高度 297→345px。
- 固定比例、浮动态和自动保存正常。

#### 下一步

连接 Android 真机验证自由拉伸和相机，再继续缩略图与 Filesystem。

#### 状态

Completed

### Change 2026-09-14 / 修复软键盘背景位移与换行焦点

#### 目标

修复 Android 点击文本栏弹出输入法后背景装饰上浮，以及按 Enter 只插入空白区域但输入焦点不移动的问题。

#### 修改了什么

- DecorationScene 改为固定在大视口层，使用 `100lvh` 保持装饰不随软键盘缩短而上浮。
- 段落编辑器补充 `data-editor-block-id`，使新段落创建后可以被准确定位和聚焦。
- Enter 后主动聚焦新段落，真实键盘输入会进入新行。
- 增加 `beforeinput` 处理 Android 软键盘的 `insertParagraph` 输入路径。
- 增加 IME composing 保护，避免中文输入法组合输入时误触发换行。
- 修复空白虚拟段落转真实段落时的重复或顺序错误。

#### 涉及文件

- `src/components/themes/DecorationScene.vue`
- `src/components/editor/EditableParagraph.vue`
- `src/components/editor/DiaryBlockEditor.vue`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

旧装饰层高度使用普通视口，Android 键盘弹出后视口缩短，`%` 定位随之变化。换行逻辑则已创建新 Block，但缺少可查询的 Block ID，导致 `focusBlock()` 找不到新段落。

#### 怎么实现

装饰层使用 `position: fixed` + `height: 100lvh` 稳定高度。段落根节点加入 `data-editor-block-id`；Enter 创建 Block 后调用 `focusBlock()` 聚焦新节点。Android 若由 beforeinput 触发 `insertParagraph`，走同一套拆分逻辑。

#### 数据影响

- 数据库：无影响。
- Model：无影响。
- API：无影响。
- Migration：不需要。
- Encryption：无影响。
- Sync：无影响。

#### 风险

- `lvh` 在极旧 Android WebView 上会回退到 `100vh`。
- 不同输入法的 Enter/发送键行为可能需要真机继续验证。

#### 测试

- `npm test`：12 个测试通过。
- `npm run build`：生产构建通过。
- 浏览器验证：Enter 后焦点进入新段落，继续输入写入新行。
- 中文 IME composing 保护已加入。

#### 下一步

Android 真机验证软键盘、中文输入法和自由拉伸触控手感。

#### 状态

Completed

### Change 2026-09-14 / Phase 3 主题设置

#### 目标

完成六种首页装饰主题的固定、自动轮换和参与主题配置，让用户可以在二级设置页控制首页氛围，同时保持首页始终是写作优先。

#### 修改了什么

- 设置页新增固定主题 / 自动轮换模式。
- 自动轮换支持每次打开和每天一次。
- 六种主题新增可视化预览。
- 固定模式支持选择唯一主题。
- 随机模式支持多选参与轮换主题，并阻止清空到 0 个。
- ThemeService 增加每日主题有效性检查。
- 设置保存后立即刷新当前主题。
- 增加主题服务单元测试。

#### 涉及文件

- `src/views/Settings/SettingsView.vue`
- `src/components/themes/ThemeSwatch.vue`
- `src/services/theme/DecorationThemeService.js`
- `tests/theme-service.test.js`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

主题应该陪伴写作，但不能重新变成首页的第一层入口。设置放在二级页面，首页继续只显示当天写作和轻量装饰。主题注册表集中管理，新增主题不需要修改页面逻辑。

#### 怎么实现

SettingsView 读取 ThemeService catalog/settings，并保存 mode、rotation、fixedThemeId、enabledThemes。ThemeSwatch 渲染本地注册表中的 SVG 装饰。首页启动时通过 ThemeService 解析固定或随机主题。

#### 数据影响

- 数据库：无 schema 变化。
- Model：沿用 ThemeSettings。
- API：无影响。
- Migration：不需要。
- Encryption：无影响。
- Sync：主题设置属于本地 UI 设置，暂不参与日记同步。

#### 风险

- 每日轮换使用本地日期，跨时区设备的定义需要未来明确。
- 主题装饰目前仍以少量 SVG 为主。
- 主题设置不会同步到其他设备。

#### 测试

- `npm test`：15 个测试通过。
- `npm run build`：通过。
- 浏览器验证：固定植物、自动轮换、每日一次、取消云朵参与均保存并显示成功。
- 验证后已恢复为默认云朵固定主题。

#### 下一步

进入 Phase 4：搜索、日历、标签、心情、收藏和草稿管理。

#### 状态

Completed

### Change 2026-09-14 / Phase 4 搜索、日历、心情与收藏

#### 目标

让已经写下的日记可以被找到、按日期浏览，并支持心情和收藏标记，同时保持首页仍是第一写作入口。

#### 修改了什么

- 新增 SearchView：正文搜索、收藏筛选、心情筛选。
- 新增 CalendarView：月视图、前后月份切换、有日记日期标记、选中日期列表。
- Today 的更多菜单增加搜索和日历入口。
- DiaryService 增加 search、listByDateRange、toggleFavorite、setMood。
- 日记详情增加收藏/取消收藏和心情选择。
- Today 与编辑页的“心情”工具从后续开放改为可用。
- 时间线和详情显示心情名称。
- 新增 Mood 模型与固定心情选项。
- 增加 Phase 4 服务测试。

#### 涉及文件

- `src/models/Mood.js`
- `src/services/diary/DiaryService.js`
- `src/views/Search/SearchView.vue`
- `src/views/Calendar/CalendarView.vue`
- `src/views/Today/TodayView.vue`
- `src/views/DiaryDetail/DiaryDetailView.vue`
- `src/views/DiaryDetail/DiaryEditView.vue`
- `src/components/common/AppIcon.vue`
- `src/components/diary/DiaryTimeline.vue`
- `src/router/index.js`
- `tests/diary-phase4.test.js`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

搜索和日历属于回顾功能，不应占用首页第一层。收藏和心情作为日记 metadata 自然参与检索和展示。

#### 怎么实现

DiaryService 在本地日记集合上执行文本、收藏、心情和日期范围过滤。SearchView 使用 180ms 延迟查询；CalendarView 生成 6 周网格并按范围读取日记；DiaryDetailView 通过 service 更新 favorite/mood。

#### 数据影响

- 数据库：无 schema 变化。
- Model：继续使用已有 mood、favorite 字段。
- API：无远端 API 变化。
- Migration：不需要。
- Encryption：无影响。
- Sync：收藏与心情随 Diary 记录同步。

#### 风险

- 搜索目前是内存过滤，日记量很大时需要索引。
- 日历只显示正式日记，不含草稿。
- 标签和完整草稿管理尚未完成。

#### 测试

- `npm test`：5 个测试文件、18 个测试通过。
- `npm run build`：通过。
- 浏览器验证：正文搜索命中、收藏筛选命中、平静心情筛选命中、日历标记并展示当天日记。
- 测试日记已永久清理。

#### 下一步

完成 Phase 4 剩余部分：标签和草稿管理；随后进入 Phase 5 加密。

#### 状态

Completed

### Change 2026-09-14 / Phase 4 完成：标签与草稿管理

#### 目标

补齐 Phase 4 的内容整理能力：心情前台展示、标签创建与筛选、草稿列表、继续编辑和删除。

#### 修改了什么

- 心情选择后显示在首页和编辑页前台，可点击更改。
- 已选标签显示在编辑前台。
- 新增 Tag 模型与 TagService。
- 标签支持创建、去重、选择和删除。
- 搜索支持标签筛选。
- 详情页展示心情与标签徽标。
- 新增草稿列表页面，支持继续编辑和删除。
- Today 支持通过 `?draft=id` 打开指定草稿。
- 发布草稿后清除查询参数并创建新草稿。
- 增加标签和草稿服务测试。

#### 涉及文件

- `src/models/Tag.js`
- `src/models/Mood.js`
- `src/services/tag/TagService.js`
- `src/services/diary/DiaryService.js`
- `src/components/diary/TagPickerSheet.vue`
- `src/views/DiaryDetail/DraftsView.vue`
- `src/views/Today/TodayView.vue`
- `src/views/DiaryDetail/DiaryEditView.vue`
- `src/views/DiaryDetail/DiaryDetailView.vue`
- `src/views/Search/SearchView.vue`
- `src/router/index.js`
- `tests/diary-phase4.test.js`
- `tests/tag-service.test.js`
- `docs/PROJECT_DESIGN.md`

#### 为什么这样修改

心情和标签需要即时反馈，否则用户不知道是否设置成功。草稿需要独立管理，否则未完成内容只能依赖“最近一份草稿”。

#### 怎么实现

TagService 使用 settings Repository 保存标签定义，Diary.tagIds 保存引用。草稿继续使用同一 Diary 模型，listDrafts/getDraftById/deleteDraft 负责管理。Today 通过查询参数选择草稿。

#### 数据影响

- 数据库：无 schema 变化。
- Model：复用 mood、tagIds、draft。
- API：无影响。
- Migration：不需要。
- Encryption：无影响。
- Sync：标签定义和日记引用将在同步阶段分别处理。

#### 风险

- 当前没有标签重命名/排序。
- 删除标签会从当前日记清除引用，其他历史日记中的孤儿 tagId 只在展示时忽略。
- 草稿没有独立附件孤儿清理策略之外的新机制。

#### 测试

- `npm test`：6 个测试文件、20 个测试通过。
- `npm run build`：通过。
- 浏览器验证：心情和标签前台显示、标签创建与删除、草稿列表、草稿继续编辑、标签搜索筛选均通过。
- 验证数据和标签已清理。

#### 下一步

进入 Phase 5：单篇日记加密与附件加密策略。

#### 状态

Completed

### Change 2026-09-20 / 数据安全与 Android 稳定性收尾

#### 目标

在进入 Phase 5 前完成用户可控的完整备份与原子恢复、Android 数据保护和相机生命周期恢复，并收尾原生附件存储、缩略图、caption 与附件一致性。

#### 修改了什么

- 新增备份格式 v1：单一 JSON 包含日记、草稿、Blocks、心情/收藏/标签引用、设置/主题、附件 metadata、原图和缩略图二进制、schemaVersion、导出时间和应用版本。
- 导入在写入前严格校验格式、版本、字段类型、重复 ID、Block/标签/附件引用、MIME、文件大小与 Base64；第一版仅支持二次确认后的全量替换。
- IndexedDB `replaceAll` 在一个 transaction 内替换全部数据；失败时回滚并保留原数据，不删除或重建数据库。
- 设置页增加导出、文件选择、危险操作确认、处理中禁用和成功/失败反馈；交互状态下沉到 `useBackupControls`。
- 新增 `@capacitor/share` 和 PlatformBackupFileProvider：Web 保留下载，Android 使用私有 Cache + 系统分享面板交付单一 JSON；取消/失败会清理临时明文并给出安全反馈。
- Android 设置 `android:allowBackup="false"`，避免明文日记和附件进入不受应用控制的系统备份。
- 新增 `@capacitor/app`，处理 Camera `appRestoredResult`；使用持久化 pending context 与 captureId 防止重复插图，并在失败时补偿清理。
- 新增 `@capacitor/filesystem` 和 AttachmentDataProvider；Web 使用 IndexedDB，原生在应用私有目录保存性能镜像并保留 IndexedDB 回退。
- schema v3 追加 `thumbnail_blobs`；缩略图最长边 480px、JPEG 质量 0.78，时间线和搜索只加载缩略图。
- 图片 caption 增加编辑入口，参与自动保存并在详情展示。
- 删除 Block、删除草稿、永久删除日记、相机恢复失败和应用启动时均执行相应附件清理；原生镜像按 metadata 引用清理。

#### 涉及文件

- `package.json`、`package-lock.json`
- `android/app/build.gradle`、`android/gradle/wrapper/gradle-wrapper.properties`
- `android/app/src/main/AndroidManifest.xml`
- `src/database/schemas/schema.js`、`src/database/migrations/index.js`
- `src/models/Attachment.js`
- `src/providers/storage/IndexedDbStorageProvider.js`
- `src/providers/backup/PlatformBackupFileProvider.js`
- `src/providers/media/AttachmentDataProvider.js`、`IndexedDbAttachmentDataProvider.js`、`CapacitorFilesystemAttachmentProvider.js`、`CameraRestoreCoordinator.js`、`CapacitorMediaProvider.js`
- `src/repositories/interfaces/AttachmentRepository.js`、`src/repositories/local/IndexedDbAttachmentRepository.js`
- `src/services/backup/BackupService.js`
- `src/services/media/AttachmentService.js`、`CameraRecoveryService.js`、`createImageThumbnail.js`
- `src/services/container.js`
- `src/composables/useDiaryEditor.js`、`src/composables/useBackupControls.js`
- `src/components/editor/DiaryBlockEditor.vue`
- `src/views/Today/TodayView.vue`、`src/views/DiaryDetail/DiaryEditView.vue`、`DiaryDetailView.vue`
- `src/views/Diaries/DiariesView.vue`、`src/views/Search/SearchView.vue`、`src/views/Calendar/CalendarView.vue`、`src/views/Settings/SettingsView.vue`
- `src/main.js`
- `tests/backup-service.test.js`、`backup-controls.test.js`、`backup-file-provider.test.js`、`attachment-service.test.js`、`filesystem-provider.test.js`、`camera-recovery.test.js`、`diary-editor-autosave.test.js`、`diary-model.test.js`、`indexeddb-storage.test.js`

#### 数据模型和迁移影响

- schemaVersion 从 2 升至 3，只追加 `thumbnail_blobs` store；v1/v2 migration 未修改。
- Attachment metadata 增加 `thumbnailUri`、`thumbnailMimeType`、`thumbnailSize` 和可空 `captureId`；normalize 对旧记录提供默认值。
- 既有 `attachment_blobs` 不清空、不搬走；旧附件仍可直接读取，并在需要缩略图时懒生成。
- 原生 Filesystem 只保存可重建镜像，IndexedDB 继续作为备份导出和兼容读取的可信副本。
- 导入时将来源设备 Filesystem URI 归一化为 IndexedDB URI；成功后尽力清理无 metadata 的原生镜像。

#### 风险

- 备份文件未加密，用户必须保存到可信位置。
- JSON Base64 对大量高分辨率图片有体积和峰值内存开销。
- Filesystem 与 IndexedDB 无跨介质事务；实现以 IndexedDB 先成功、原生文件失败回退和后续清理保证不丢数据。
- 缩略图依赖浏览器图像解码/Canvas 能力；不支持时保留原图但列表跳过缩略图。
- 相机进程回收恢复、真实拍照确认和更多 Android 厂商的 Photo Picker 行为仍需扩大真机覆盖。

#### 测试结果

- `npm test`：13 个测试文件、52 项测试通过。
- 覆盖完整导出/恢复、Blob 与缩略图往返、非法格式、版本不兼容、重复 ID、缺失附件、事务失败回滚、跨设备 URI 归一化、附件保存/读取/删除、Filesystem 回退与镜像清理、相机恢复去重、caption、650ms 自动保存、路由离开刷新和设置页备份交互。
- `npm run build`：通过，Vite 转换 119 个模块。
- `npx cap sync android`：通过；识别 `@capacitor/app@7.1.2`、`@capacitor/camera@7.0.5`、`@capacitor/filesystem@7.1.8` 和 `@capacitor/share@7.0.4`。
- 本地浏览器实际验证：正文输入后显示“草稿已保存”，离开写作路由进入设置页正常；备份入口、明文风险说明、替换警告均可见，导出成功反馈包含正确的日记/附件数量。
- 未用测试备份执行真实替换导入，避免覆盖浏览器现有数据；严格校验、确认状态、成功/失败反馈和事务回滚由自动化测试覆盖。
- Android SDK：使用官方 command-line tools，安装 `platform-tools`、`platforms;android-35` 与 Build Tools 34/35；JDK 使用本机 JDK 21。未修改网络代理。
- `android\gradlew.bat assembleDebug --no-daemon`：通过，195 个任务执行成功。Debug 包使用 `com.zhuanz1.diary.debug`，避免因设备上既有正式包签名不同而要求卸载、从而保护原应用数据。
- 真机：OPPO PJU110，Android 14 / API 34。Debug APK 独立安装、冷启动成功，Capacitor App / Camera / Filesystem / Share 插件正常注册，无 AndroidRuntime 崩溃或 WebView 未捕获异常。
- 真机写作：输入正文后 650ms 自动保存，进入设置页再返回可恢复；设置页备份入口、明文提示和替换警告可见。
- 真机 Camera / Photos：系统相机和 Photo Picker 均可打开；取消后 pending context 清空，附件 metadata、原图和缩略图 store 均无孤儿记录。
- 真机附件：仅选择临时创建的测试图片，原图与缩略图分别写入应用私有 Filesystem，IndexedDB metadata 引用正确；caption 进入自动保存；删除图片 Block 后三个附件 store 与私有文件目录均清理为零。测试媒体随后已从共享存储删除。
- 真机备份导出：单一 JSON 写入私有 Cache 后由系统分享面板正确识别文件名和内容；取消分享显示“已取消保存”，临时明文文件立即删除，未再出现 WebView `blob:` 下载无落盘却误报成功的问题。

#### 未完成的真机验证

- 相机 Activity 打开期间由系统强制回收 App 后的真实恢复、重复事件去重和目标草稿定位。
- 真实拍照确认流程；本轮只验证了相机打开与取消，未保存设备照片。
- Filesystem 私有目录写入失败时的真机强制回退，以及卸载/正式包升级后的行为。
- 多张高分辨率大图的缩略图生成、列表滚动内存和触屏图片排序。
- 中文输入法长文本组合输入、系统文件选择器真实导入和成功保存到具体目标后的回读。
- release 签名包的安装、升级和系统备份行为。

#### 下一步

先完成上述 Android 发布前专项矩阵；随后建立 release 签名与升级验证，再设计 Phase 5 单篇日记和附件加密。

#### 状态

Completed（代码、自动化测试、Web/Android 构建与核心真机冒烟）；发布前专项真机验证仍待执行。

### Change 2026-10-03 / 真机备份恢复与写作焦点回归

#### 目标与修改

- 在独立 Debug 应用中完成带图片备份的真实导出、系统文件选择器替换导入与内容回读，不触碰设备上原有正式包。
- 相册选择器与相机一样，在启动外部 Activity 前先持久化草稿；空白草稿也能为进程恢复提供稳定的目标 ID。
- 空白虚拟段落首次输入时沿用同一 Block ID，避免替换当前输入节点；开始下一篇草稿前轮换 ID，避免跨日记复用。
- 将开发依赖中的 `brace-expansion` 从 5.0.9 更新到 5.0.12；`npm audit` 已无已知漏洞。
- 根据 Android 官方文档，为 Android 12+ 增加云备份与设备间传输的显式全域排除规则；保留 `allowBackup=false` 并为 Android 11 及更早版本增加旧格式规则。
- 依据：[Android Auto Backup 官方文档](https://developer.android.com/identity/data/autobackup)说明部分厂商不会仅凭 `allowBackup=false` 禁用设备间传输，且缺少 `<device-transfer>` 规则时会默认纳入应用数据。

#### 涉及文件与数据影响

- `src/views/Today/TodayView.vue`、`src/composables/useDiaryEditor.js`、`src/components/editor/DiaryBlockEditor.vue`、`tests/diary-editor-autosave.test.js`、`tests/android-backup-rules.test.js`、`android/app/src/main/AndroidManifest.xml`、`android/app/src/main/res/xml/data_extraction_rules.xml`、`full_backup_content.xml`、`package-lock.json`、本设计文档。
- 不改变数据模型和 schemaVersion，不新增或修改 migration；既有数据库不清空。打开外部图片选择器时，原本只在内存中的空白草稿会提前写入数据库。

#### 验证结果

- `npm test`：备份规则测试加入后共 14 个文件、56 项；`npm run build`、`cap sync android` 与 Debug `assembleDebug --no-daemon` 均通过。合并后的 Debug Manifest 保持 `allowBackup=false`，包名为 `com.zhuanz1.diary.debug`。
- OPPO PJU110 / Android 14：打开 Photo Picker 前通过 WebView 调试读到空白草稿已持久化；选取专用测试图片后，附件 metadata、原图和缩略图分别保存。
- 设置页通过系统分享面板导出单一 JSON；再由系统 DocumentsUI 选回测试备份，经危险操作确认完成替换。导出之后新增的测试草稿被移除、主题由“植物”恢复为“云朵”，保留的正式日记与附件引用完整。
- 导入后 IndexedDB 原图 297,363 字节、缩略图 39,367 字节，二者 SHA-256 均与备份文件内二进制一致。历史时间线加载 480×439 缩略图，详情加载 1312×1199 原图并展示 caption。
- 空白段落首字输入后，DOM 节点与焦点保持不变；继续输入、自动保存及强制关闭后重启读回通过。中文输入法的完整长文本组合仍需独立人工验证，ADB 快速输入不能代替真实输入法测试。
- 单张 6000×4000 合成 JPEG 通过原生 Photo Picker 导入后，原图按配置限制为 2400×1600，并独立生成 JPEG 缩略图；删除含该图的测试草稿后，原图与缩略图的私有 Filesystem 镜像均删除。此为单张冒烟，不能替代多张大图长时间滚动压力测试。
- Android APK 的合并 Manifest 与编译后的 `data_extraction_rules.xml` 已检查，`allowBackup=false`、云备份及设备间传输排除规则均在包内。新 Debug APK 覆盖安装成功，Debug 与原有正式包并存且原有测试附件仍可读取；尚未执行设备到设备迁移的端到端审计。
- 已删除共享相册中的专用测试图、下载目录中的明文测试备份和电脑临时副本；项目原始素材及 Debug 应用内一篇用于恢复验证的测试日记未删除。

#### 风险与下一步

- 尝试用 `am kill` 回收前台 Photo Picker 背后的 App 时，设备没有终止进程；用 Debug 包权限强制结束进程后，OPPO 同时关闭了选择器。因此尚未声称真实系统低内存回收的 `appRestoredResult` 已通过真机验证。继续使用受控低内存场景或另一台设备验证。
- 真实拍照确认、多张高分辨率图片压力、分享至用户选定保存目标后的回读、正式签名包升级和系统备份行为仍需发布前专项验证。备份格式 v1 仍为未加密 JSON，必须由用户保存到可信位置；Phase 5 加密尚未开始。

### Change 2026-10-03 / 本机备份保存与中断恢复加固

#### 目标与修改

- 在 OPPO 分享面板缺少明确本机保存目标的情况下，增加 Android 标准 `ACTION_CREATE_DOCUMENT` 文件保存通道。设置页默认“保存备份文件”，另有明确的“通过其他应用分享”；只有系统文件写入完成后才显示“已保存”。Web 仍用标准下载，并只提示下载已触发。
- 将完整备份格式从 v1 升为 v2：每个附件原图和缩略图都有必需的 SHA-256；导入事务前验证字节内容、大小、MIME、ID 与引用。继续接受旧 v1 文件，不修改已存在备份。
- 恢复提交与后续设置页刷新分开反馈；刷新失败不能误报为“原有数据未被替换”。
- 全局删除标签时在一个 IndexedDB 事务中清理所有日记、草稿、回收站引用，避免悬空标签导致导出失败；服务仍通过 SettingsRepository 接口访问存储。
- 相机/相册返回时只暂存图片 URI，不将二进制放入 localStorage；正常选图或 `appRestoredResult` 都在原图与 Diary Block 成功保存后确认消费。重启时保护待恢复附件不被孤儿清理误删，按 captureId 去重续做。历史日记打开相册前也先强制保存；普通图片插入后立即持久化而不等待 650ms 防抖。
- 删除图片 Block 时检查已保存日记是否仍有其他 Block 引用同一附件；缩略图晚到时在单一事务里确认 metadata 仍存在。IndexedDB 为附件的可靠副本，原生镜像删除失败不再阻止 canonical metadata 删除，孤儿镜像由后续清理重试。

#### 涉及文件与数据影响

- 备份：`src/services/backup/BackupService.js`、`src/providers/backup/PlatformBackupFileProvider.js`、`src/composables/useBackupControls.js`、`src/views/Settings/SettingsView.vue`、`android/app/src/main/java/com/zhuanz1/diary/BackupDocumentPlugin.java`、`MainActivity.java`。
- 生命周期与附件：`src/providers/media/CameraRestoreCoordinator.js`、`CapacitorMediaProvider.js`、`CapacitorFilesystemAttachmentProvider.js`、`src/services/media/AttachmentService.js`、`CameraRecoveryService.js`、`src/repositories/local/IndexedDbAttachmentRepository.js`、`src/views/Today/TodayView.vue`、`src/views/DiaryDetail/DiaryEditView.vue`。
- 标签：`src/services/tag/TagService.js`、`src/repositories/interfaces/SettingsRepository.js`、`src/repositories/local/IndexedDbSettingsRepository.js`、`src/providers/storage/IndexedDbStorageProvider.js`。相关自动化测试与本设计文档同步更新。
- 数据库 schemaVersion 仍为 3，不新增、不修改历史 migration，不清空数据库。备份文件新导出为 v2；旧 v1 可导入。相机暂存仅包含 captureId、目标日记 ID、时间和临时 URI，确认后清理。Android 私有 Cache 明文备份在完成、取消或失败后删除。

#### 验证结果

- `npm test`：16 个文件、78 项通过；`npm run build`、`cap sync android`、Android Debug 和 unsigned Release `assemble` 均通过。Release 尚未签名，也未安装或升级正式包。
- Debug 包在 OPPO PJU110 / Android 14 覆盖安装，原有 Debug 数据保留，正式包未触碰。实际通过系统 DocumentsUI 保存 451,333 字节 v1 测试备份并回读，之后保存约 1 MB 的 v2 测试备份并从该文件替换恢复，界面报告 2 篇日记、2 个附件。取消系统保存选择器正确显示“已取消保存”；成功和取消后私有 Cache 目录均为空。
- 真机从 Photo Picker 选择受控测试图片后，空白草稿和图片 Block 成功保存；WebView 调试确认相机 pending/staged 上下文均已清除、处理 ID 已记录。本次共享测试图片和两份下载目录中的明文测试备份已核对并删除，仅 Debug 应用内保留受控测试记录。
- 自动化补充覆盖 v1 兼容、v2 等长字节篡改与缺失摘要拒绝、恢复后刷新错误反馈、全局标签删除回滚、共享图片引用、缩略图删除竞态、相机暂存重放与去重、原生文件保存成功/取消/失败反馈，以及自动保存失败时阻止路由离开、后台保存失败时保留编辑内容。

#### 风险与下一步

- SHA-256 只用于意外损坏检测，不提供保密或防恶意篡改认证；旧 v1 无摘要。明文备份必须由用户保存到可信位置。大图库的 JSON + Base64 峰值内存仍待未来流式 v3 方案解决。
- OPPO 在强制结束 App 时同步关闭 Photo Picker，本次没有验证真实系统低内存回收、真实相机快门、中文输入法长组合输入或多张大图压力；`appRestoredResult` 重放由自动化测试覆盖，但端到端真机恢复仍需验证。
- `ACTION_CREATE_DOCUMENT` 的正常保存和回读已验证；保存选择器/写入过程中的系统进程回收、第三方 DocumentsProvider 失败行为仍需专项验证。原生插件持久化待写入 URI，启动后会尝试幂等重写；不能保证系统已清除的临时源文件仍可恢复。
- 正式签名密钥、正式包升级、设备间传输与系统备份审计需要发布环境与真机矩阵；本轮只构建了 unsigned Release，没有擅自处理用户正式应用或签名材料。

### Change 2026-10-03 / 相机进程恢复真机回归与临时文件清理

#### 目标与修改

- 自动保存失败时阻止路由离开，保留编辑内容；没有待保存改动时不再做冗余写入。后台保存失败仍显示错误状态，避免未处理的 Promise 拒绝。
- OPPO 真机上通过 `am kill` 在相机前台回收 Debug 进程，发现厂商相机有时只留下零字节临时文件。原生恢复回调报错时，先尝试拾回本次已写入的 Camera 文件；没有可读照片则明确提示重拍，不再静默当作普通取消。
- Android Camera 的应用专属 `External/Pictures/JPEG_*` 临时文件仅在附件与 Diary Block 成功提交后删除；启动时清理零字节和超过 24 小时的文件，保护仍可恢复的近期非空照片。
- 恢复流程在 Diary Block 已提交后，即使运行时图片读取或 UI 通知失败，也绝不删除已被引用的附件；待恢复上下文保留以供后续重试。

#### 涉及文件与数据影响

- `src/composables/useDiaryEditor.js`、`src/providers/media/CameraTempFileProvider.js`、`CameraRestoreCoordinator.js`、`CapacitorMediaProvider.js`、`src/services/media/CameraRecoveryService.js`、`AttachmentService.js`、两个编辑 View、相关测试与本设计文档。
- 不改变 IndexedDB schema v3、历史 migration、备份格式 v2 或用户日记内容。临时照片清理只访问应用自有 External/Pictures 下符合 Capacitor Camera 文件名模式的文件；正式 App 包不受 Debug 测试影响。

#### 验证结果与风险

- `npm test`：17 个文件、85 项通过；`npm run build` 与 `npx cap sync android` 通过。Debug 与 unsigned Release 重新构建通过，正式 Release 未签名、未安装。
- OPPO PJU110 / Android 14：普通真实拍照确认后立即保存图片 Block，删除后原图、缩略图回到原有数量，Camera 临时文件在成功提交后消失。
- 同一手机在相机前台以 `am kill` 结束 Debug 进程后，有一次原生 Camera 返回取消且临时文件为 0 字节，照片无法恢复；另一次进程确实重启并通过 `appRestoredResult` 恢复了照片，日记仅增加一张图。删除测试图后附件目录恢复原状。回收后主动取消拍摄会显示明确未保存提示，且能再次启动相机。
- 本次生成的测试照片 Block、附件和对应临时文件已清除；此前测试遗留的一份已确认无引用的 Camera 临时照片也按精确路径删除。Debug 应用内原有受控测试日记保留，设备上的正式应用未修改。
- `am kill` 是受控后台进程回收，不等同于所有厂商的自动低内存回收；0 字节照片没有可恢复的像素。还需跨机型、长时间大图压力、第三方文档提供器、正式签名升级与系统备份审计。

### Change 2026-10-07 / 一致备份快照与系统保存中断收尾

#### 目标

继续已有实现，不回滚或重复开发；收尾备份一致性、系统文档保存的进程恢复和图片性能回归，不进入加密、同步或其他新阶段。

#### 修改内容

- 聚合 BackupRepository 接口隔离存储事务，依赖仍统一在 container。导出在一个只读事务中读取日记、metadata、原图、缩略图和设置；并发替换/删除不会造成跨时间点的备份。事务完成后再编码和摘要校验。
- 保留备份 v2/v1 兼容、严格校验和单事务替换恢复；非法文件、重复 ID、缺失附件、摘要损坏及写入中途失败不破坏原数据。
- Android 默认保存的源文件由可被系统淘汰的 Cache 改为独立 UUID 的私有 Data 文件，JS/Native 双层防重复。成功状态与 pending 清理先持久提交，再删除源文件；旧版 pending Cache 源路径仍可恢复。
- 流复制先打开并校验源，源缺失不能触碰或删除可能已写完的目标。确实打开但未完成的部分文件才尽力删除；目标不可删时保留明确失败提示。恢复后的成功/失败状态通过 Service 展示于设置页。
- 显式分享使用独立 Cache 文件，至少保留 24 小时供接收方读取，后续分享或原生启动按名称和修改时间清理；不因为清理失败覆盖保存/取消/原始错误。活动 pending 源不参与过期清理。
- Filesystem 镜像为空、Base64 无效或长度不符合 metadata 时回退可信 IndexedDB 原图/缩略图。Web 文件选择器取消时正常返回空结果并释放隐藏 input，可再次选图。
- 新增仅连接独立 Debug 包的 ADB/CDP QA 脚本与使用说明，不新增运行时依赖，不连接正式包。
- npm audit 新发现间接依赖 `source-map-js` 公告后，仅通过 `npm update source-map-js --ignore-scripts` 将其从 1.2.1 升至兼容补丁 1.2.2；无新增依赖、无主依赖升级、无代理修改。复查 0 项漏洞。

#### 涉及文件

- 备份分层：`src/repositories/interfaces/BackupRepository.js`、`src/repositories/local/IndexedDbBackupRepository.js`、`src/services/container.js`、`src/providers/storage/IndexedDbStorageProvider.js`、`src/services/backup/BackupService.js`。
- 文件交付：`src/providers/backup/PlatformBackupFileProvider.js`、`android/app/src/main/java/com/zhuanz1/diary/BackupDocumentPlugin.java`、`BackupDocumentCopier.java`。
- 设置交互：`src/composables/useBackupControls.js`、`src/views/Settings/SettingsView.vue`。
- 图片回退/取消：`src/providers/media/CapacitorFilesystemAttachmentProvider.js`、`BrowserMediaProvider.js`。
- 测试：`tests/backup-service.test.js`、`indexeddb-storage.test.js`、`tag-service.test.js`、`backup-file-provider.test.js`、`backup-controls.test.js`、`filesystem-provider.test.js`、新增 `browser-media-provider.test.js`；新增 `android/app/src/test/java/com/zhuanz1/diary/BackupDocumentCopierTest.java`。
- 工程与文档：`scripts/qa/android-webview.mjs`、`scripts/qa/README.md`、`package-lock.json`、`docs/PROJECT_DESIGN.md`。

#### 数据模型、迁移与风险

- IndexedDB schemaVersion 仍为 3，无新 schema，无历史 migration 修改，无数据库删除/重建。备份格式仍为 v2，继续接受 v1。
- 仅修改临时文件命名、私有位置和 native 操作状态，兼容旧版中断操作。每次导出独立命名，不覆盖其他快照；用户所选系统目标不参与常规临时文件清理。
- 分享返回不代表对方保存完成；24 小时以后清理私有缓存，用户仍须核对接收应用。时间未知或文件删除失败时缓存可能延后清理，不宣称精确定时删除。
- 镜像长度检查能发现空/截断文件，不能检测所有等长损坏；完整备份依据 IndexedDB 字节并校验 SHA-256。备份仍为明文，摘要不是加密或认证。
- 私有 Data 待保存源更耐进程回收，但不是电源故障、磁盘损坏或卸载后的灾备；只能以用户实际保存的外部备份恢复。
- 现有 Git 仓库仍没有首次提交，所有未跟踪代码保留；未执行 Git commit/reset/checkout。

#### 自动化与构建结果

- 每个独立部分均运行对应测试。全量 `npm test`：18 文件、139 项通过；`npm run build` 与 `npx cap sync android` 通过。
- `gradlew.bat :app:testDebugUnitTest assembleDebug assembleRelease --no-daemon`：通过。6 项原生测试覆盖跨 64 KiB 边界字节复制、源缺失/空文件、提供器不可写、写失败和 close 失败。
- 合并 Repository 后首次全量测试发现 Tag 测试夹具仍使用旧依赖注入，已改为 BackupRepository 并重新运行，全套通过。
- JDK 21 / SDK 35；现有 flatDir 与 SDK XML 版本警告仍存在，但不影响本轮构建。Release 仅为未签名产物，未安装。

#### 本轮真机证据

- OPPO PJU110 / Android 14，仅独立 `com.zhuanz1.diary.debug` 覆盖安装；原有正式包不动。
- 3 张受控合成 JPEG，均 6000×4000，总输入 39,808,996 字节。原生图片选择器按既有配置处理为 2400×1600（约 1.98～2.11 MB），每张独立生成 480×320 缩略图（约 27～31 KB）。
- 生成 9,313,516 字节完整备份约 3.53 秒，重新导入后 3 张处理后原图 SHA-256 全部一致；时间线读取 480 像素缩略图。本次内存快照 App PSS 约 195 MiB，不视为长时间或超大图库基准。
- 删除本次测试草稿后，原有 2 篇记录、2 个附件 ID 保持不变；私有附件目录仅保留原有 2 组原图与缩略图，运行时测试 URL 已释放。
- 新插件通过设置页打开系统 DocumentsUI 后，以 `am kill` 确认 Debug PID 消失；点击保存，进程恢复，写出 1,036,572 字节备份。回读文件内 2 张原图和 2 张缩略图的 SHA-256 均匹配；设置页显示完成，Data 源目录为空。
- 本轮合成相册图片、专用 UI dump、系统下载目录中的明文测试备份及电脑临时副本已按精确目标删除。可从仍保留的原有 Debug 日记再次导出；未删除任何私人照片或正式包数据。

#### 未完成的发布前验证与下一步

- 真正系统低内存自动回收、更多厂商相机和长时间/超大图库压力；本轮 `am kill` 只是受控进程回收。
- 第三方 DocumentsProvider 的写入中途断连、权限撤销、存储不足和拒绝删除；目前原生异常分支由单元测试覆盖，本机 DocumentsUI 恢复已实测。
- 正式签名密钥与升级环境、跨设备系统备份/迁移审计；不能以 unsigned Release 或 Debug 测试替代。
- 保持当前可用版本，优先完成发布验证矩阵，再设计流式备份与后续成熟密码学加密。当前不实现云同步、语音、天气、位置或 Phase 5。

### Change 2026-10-07 / 安静纸页 UI 重设计

#### 目标与修改

- 根据「UI 重新设计」请求更新实际项目，沿用暖白、低饱和和写作优先原则，不添加 Dashboard、底部导航、外部字体/插画或新依赖。
- 重做首页日期层级、字标、正文排版与保存状态；统一公共页头、弹层、危险操作按钮、焦点提示、44px 控件、主题预览和各二级页面。
- 图片布局工具支持小屏换行，原有 caption、尺寸、比例、浮动与排序功能保留；装饰移动到底角，避开日期和添加按钮。
- 修复 320px 桌面浏览器滚动条挤占宽度时的横向滚动，以及搜索框的双清空按钮/内外双重焦点框。加强辅助文字和按钮对比度。
- 依照 Product Design 现有项目流程先查看真实页面截图，再沿用原组件、主题资产与路由进行实现；没有另建演示项目或替换业务架构。

#### 涉及文件

- 视觉基线：`src/styles/tokens.css`、`src/styles/base.css`。
- 公共组件：`src/components/common/AppHeader.vue`、`AppActionSheet.vue`、`ConfirmDialog.vue`。
- 编辑与阅读：`src/components/editor/EditableParagraph.vue`、`DiaryBlockEditor.vue`、`src/components/diary/DiaryBlocks.vue`、`DiaryTimeline.vue`、`TagPickerSheet.vue`。
- 主题：`src/components/themes/DecorationScene.vue`、`ThemeSwatch.vue`。
- 页面：`src/views/Today/TodayView.vue`、`Diaries/DiariesView.vue`、`Search/SearchView.vue`、`Calendar/CalendarView.vue`、`DiaryDetail/DraftsView.vue`、`DiaryDetail/DiaryDetailView.vue`、`DiaryDetail/DiaryEditView.vue`、`Trash/TrashView.vue`、`Settings/SettingsView.vue`。
- 本设计文档及 Capacitor sync 产生的 Android Web 资源。

#### 数据与风险

- schemaVersion 仍为 3，无新迁移、无历史 migration 改动、无数据库删除/重建；备份格式与事务语义不变。未改 Service、Repository、Provider 或依赖。
- 浏览器操作回归使用独立 `localhost:4173` 测试 origin 的明确标记样本和项目自有设计图附件，不使用私人正文或照片，不修改 Android 正式包。恢复确认仅查看并取消，没有执行替换。
- 字体使用系统现有字体栈，因此不同 Android 机型的中文字形和日期字形可能略有差异。大系统字体、软键盘、横竖屏切换和 TalkBack 仍需新版真机专项验证。
- 危险操作确认的业务逻辑保持原样；本次没有把单元测试等同于实际恢复真机结果。内嵌浏览器显示导出已触发，但没有提供可捕获的 download 事件，不能据此宣称本次已核验落盘文件。
- 不提交 Git、不回滚任何文件、不修改网络代理。当前仓库仍无首次提交，全部未跟踪文件保留。

#### 验证与下一步

- 全量 `npm test`：18 个文件、139 项通过；`npm run build` 与 `npx cap sync android` 通过；`assembleDebug --no-daemon` 通过。仍有既有 flatDir/SDK XML 版本警告。
- 实际浏览器验证 320px、390px 手机布局和桌面纸页布局；修复后页面没有横向溢出。主要按钮和图片工具按钮为 44px 高度。
- 独立生产预览验证首字输入前后的 Block ID 一致、自动保存、离开后草稿保留、继续编辑、正式发布、480px 缩略图按 80px 显示、详情 caption、编辑页图片排序/浮动环绕、搜索结果、42 格日历、备份导出反馈、导入文件选择和二次确认取消。
- 本轮不宣称新版 UI 已完成 Android 真机输入法/相机/文件保存回归；此前原生稳定性结果仍保留在历史记录。下一步优先在独立 Debug 包验证键盘弹起、中文长组合输入、系统字体放大、长文滚动、图文编辑和备份流程，不扩展到加密或云同步。

### Change 2026-10-07 / 轻描纸印六主题实装

#### 目标与修改

- 根据用户最终选定的小尺寸效果图实装六主题，并更新对应执行计划；不采用被否定的大面积写实水彩图案，不重做既有日期、正文和业务流程。
- 六张独立透明 PNG 随 App 打包；云朵、植物、小猫、纸飞机、星月、几何统一灰绿细线和少量淡色填充。主题注册表沿用原 ID，场景与设置预览共享资源。
- 新增纯展示布局函数，将装饰统一锚定纸页左下角，尺寸上限 `min(64px, 18vw)`；保留安全区、稳定视口高度和不接受点击的装饰层。设置选中和固定/自动轮换逻辑不变。
- 按 Product Design 图稿实装流程保留最终参考、生成独立透明素材并做真实浏览器同屏对照；没有另建产品或引入外部字体/运行时依赖。

#### 涉及文件

- `src/services/theme/decorationThemes.js`、`src/components/themes/DecorationScene.vue`、`ThemeSwatch.vue`、新增 `decorationLayout.js`。
- `src/assets/themes/light-paper/` 下六张 PNG：cloud、plant、cat、paper-plane、moon、geometry。
- 新增 `tests/decoration-presentation.test.js`，既有 theme-service 测试继续通过。
- `docs/THEME_REDESIGN_PLAN.md`、本设计文档、根目录 `design-qa.md`、`docs/design/light-paper-approved.png` 与 `docs/design/qa/` 实际截图/对照文件。
- Capacitor sync 更新 Android Web 资源；本轮没有修改原生插件、权限或数据库实现。

#### 数据与迁移影响

- schemaVersion 仍为 3，备份格式仍为 v2、接受 v1；无新迁移、无历史 migration 改动、无数据库删除/重建。
- 静态主题素材不是日记附件，不进入 AttachmentRepository、Block 或备份附件列表；旧设置中的六个主题 ID 无需转换。
- 浏览器采用独立 `127.0.0.1:4175` origin 和图稿示例文字，不读取或覆盖私人内容；Android 正式包和数据未触碰。全部未跟踪文件保留，未提交 Git、未执行 reset/checkout、未修改代理。

#### 测试、构建与视觉结果

- 相关测试 2 文件、27 项通过；全量 `npm test` 19 文件、163 项通过。新增测试包含真实 PNG 透明/可见像素、尺寸约束、主题 ID 兼容、Vue SSR 图片与无障碍语义。
- `npm run build` 通过（129 模块）；`npm exec -- cap sync android` 通过，使用同一项目 cap CLI。
- `gradlew.bat assembleDebug --no-daemon` 通过（195 任务）。首次 JAVA_HOME 缺失后定位现有 JDK `D:\java21`，只设置当前构建命令环境并重跑；既有 flatDir / SDK XML 版本警告保留。APK 8,467,201 字节，未安装、未运行新版真机测试。
- 实际浏览器六主题 390×844 均为 64×64px、左上 20,756；320px 缩至约 57.59px；1024×900 桌面锚定纸页 208,812。无横向溢出，右下添加按钮保持 52px。
- 设置预览、固定选择、每日轮换与多选持久化、自动保存、离开后草稿保留通过；error 级控制台日志为空。真实对照截图和范围差异详见 `design-qa.md`。

#### 风险、未完成验证与下一步

- 静态素材合计约 1.45 MB，部分高分辨率源可后续做无视觉损失的构建期优化；不能以增大显示尺寸补偿细节。系统字体/设备像素比与生成图会有合理差异，既有写作 UI 保留。
- 新主题 Android 软键盘、横竖屏、系统大字体、离线启动及 TalkBack 未在真机验证；APK/sync 和历史 OPPO 稳定性证据均不等同于本次验证。
- 本轮实装与浏览器/工程验收完成，下一步按主题计划做独立 Debug 真机专项；不自动扩大到加密、云同步或其他阶段。

### Change 2026-10-08 / 主题 Android 真机回归与旋转修复

#### 目标与修改

- 继续上一轮主题实装，仅在独立 Debug 包验证 Android 显示与输入，不进入新功能阶段。
- 真机发现：正文焦点在键盘收起后仍保留，旧逻辑跳过全部 resize，旋转后装饰落在竖屏高度之外。新增纯视口策略，只冻结同宽编辑的键盘收缩；宽度变化、高度恢复和旋转连续 resize 更新布局。
- Android 旋转与 IME 调整分多次事件完成，因此保留最后一次事件后的 300ms 旋转窗口；旋转期间在布局后的动画帧中显示仍有效的当前输入行。普通同宽打字不主动滚动；卸载时清理定时器和动画帧。
- 极短可见视口（≤240 CSS px）临时隐藏装饰，避免横屏键盘状态下图案盖住输入行；关闭键盘恢复原主题，未改 ID 或设置。

#### 涉及文件与数据影响

- `src/views/Today/TodayView.vue`、`src/components/themes/DecorationScene.vue`、新增 `src/utils/stableViewport.js`、`tests/stable-viewport.test.js`。
- `docs/THEME_REDESIGN_PLAN.md`、根目录 `design-qa.md`、本设计文档、`docs/design/qa/android/` 真机截图与 sync 后的 Android Web 资源。
- 无 schema/migration/备份格式或依赖变动；没有清空、删除、重建数据库，也没有删除用户草稿或附件。未改代理、正式包、签名或提交 Git，保留全部未跟踪文件。
- 在确认原工作草稿为空白后输入自有 QA 标记，验证保存后仅清空本次文字，保留原草稿。正常保存产生 revision，不能宣称该空草稿 metadata 未变化。主题恢复固定云朵。

#### 结果、风险与未完成项

- OPPO PJU110 / Android 14，720×1612、320 dpi。六主题/预览、键盘开关、焦点保留时旋转及带键盘旋转通过；最终截图确认输入行在键盘上方、装饰不覆盖输入，关闭键盘及回到竖屏恢复。
- 手机拒绝 shell 直接修改字体（WRITE_SETTINGS）；未扩大权限。通过正常系统字体 UI 设置「超大」并读取 1.6，验证竖屏换行/控件和输入页后恢复 1.0。自动旋转恢复 free、user_rotation=0、accelerometer_rotation=1，字体家族未改。
- QA 标记 17 个字符经当前中文 IME 将连字符转换为全角后仍完整；自动保存后 `am force-stop` Debug 包并重启保留。编辑器清空自有文字后再次冷启动确认空白，未做数据库脚本或删除原记录。截图证据保留；设备上两个自有 `/data/local/tmp/diary-theme-qa.*` 临时文件已删除。
- 新增 12 项视口测试；最新全量 `npm test` **20 文件、175 项通过**，`npm run build` 130 模块通过，`npm exec -- cap sync android` 及 `assembleDebug --no-daemon` 通过。最终 APK 8,511,191 字节，已覆盖安装并复测独立 Debug 包；既有 flatDir / SDK XML 警告仍在。Release、原生 JUnit、audit、相机和系统文件保存没有在本轮重跑。
- 一次旋转中 UI hierarchy 返回 null，最终验收以稳定截图为准；不以异常 dump 假报成功。旋转窗口策略需要更多厂商/输入法验证，当前只有本机证据。
- 未关闭手机网络；冷启动只证明本地打包运行与草稿持久化，不等于真正断网验收。中文长组合输入、长文、大字体横屏、多机型/密度和 TalkBack 仍待专项。下一步先补这些验证，再准备正式签名和升级安装，不扩展加密或云同步。

### Change 2026-10-08 / 保存可靠性与发布前输入专项收尾

#### 目标与修改

- 继续已有实现，完成当前设备可执行的中文输入、长文、大字体横屏、真正断网冷启动和工程回归，不进入新功能阶段。
- 重现并修复：旧生命周期快照写入完成后清掉较新正文的 dirty 状态；仅修改心情/标签时干净编辑器不触发持久化。新增统一 `updateMetadata()`，脱离响应式的正文/metadata 快照，提交后保留较新字段、失败重试及有意义的空白草稿 metadata 保存。
- 发布写入后等待期间的新改动保存，后续保存保持正式记录；首页在发布期间用 inert 暂停编辑和页头操作、禁用添加入口，避免成功后重置草稿丢输入。离开路由也等待较新输入保存；失败阻止离开。历史编辑页补足可见保存错误。
- 长段落旋转按实际 Selection/Range 光标位置滚动，而非段落中心；IME 压缩时临时隐藏装饰，普通打字不主动滚动。
- 当前状态/路由入口、Block 输入规则和旧 heading 描述按实际代码修正；新增发布验收清单，不把历史证据或未签名构建冒充当前完整发布。

#### 涉及文件与数据影响

- `src/composables/useDiaryEditor.js`、`src/views/Today/TodayView.vue`、`src/views/DiaryDetail/DiaryEditView.vue`。
- `src/utils/stableViewport.js`、新增 `src/utils/editorCaret.js`；`tests/diary-editor-autosave.test.js`、`tests/stable-viewport.test.js`、新增 `tests/editor-caret.test.js`。
- 本文档、`docs/THEME_REDESIGN_PLAN.md`、新增 `docs/RELEASE_READINESS.md`、`design-qa.md`、`docs/design/qa/android/` 真机证据，及 Capacitor sync 后的 Android Web 资源。
- schemaVersion 3、备份 v2/v1 不变，无新增 migration、历史 migration 改动或 npm 依赖。未删除/重建数据库、用户草稿或附件，未改代理、正式包、签名或 Git commit。
- 原编辑页为空白；自有 QA 长文摘要确认后才清空，原草稿保留。正常保存更新 revision/updatedAt。手机字号/旋转/移动数据恢复，两个自有设备临时文件清理，工作区截图保留。

#### 测试与真机结果

- 保存/视口/光标专项 3 文件 47 项通过；全量 `npm test` **21 文件 204 项通过**。Vite build 131 模块、Capacitor sync、`:app:testDebugUnitTest assembleDebug assembleRelease --no-daemon` 通过，7 项 JUnit（备份流复制 6 项），npm audit 0 项漏洞。
- OPPO PJU110 / Android 14 真实搜狗九键候选输入 `你好`、`今天想记录`，未提交候选期间自动保存不打断，提交文字准确。不是全部输入法/composition 实现的覆盖声明。
- 最终包 1844 字 QA 长文真正断网冷启动：无 active default network、Wi-Fi=0、移动数据=0，文本 SHA-256 相同；移动网络 finally 恢复。1.6 倍字号横屏截图明确显示末尾光标在键盘上方，普通竖屏长文无装饰压文字。最终清除 QA 文字并再次冷启动确认空白。
- Release APK 实际 Manifest 中 `allowBackup=false`，同时打包新旧系统排除资源；Debug 签名验证通过。仅独立 Debug 包升级，不安装未签名 Release 或覆盖正式包。

#### 风险、外部条件与下一步

- 单机输入/布局证据不覆盖其他厂商和 IME；TalkBack 人工朗读/焦点、真正系统低内存、长时间/超大图库、第三方 DocumentsProvider 和设备备份行为仍需专项环境。相机/系统文件保存的生命周期是此前证据，本次未复测。
- 正式签名身份、分发渠道、版本策略和同签名升级需要发布材料/设备，不能用 Debug 密钥或任意新密钥替代。npm 版本 0.1.0 与 Android versionName 1.0/versionCode 1 保持现状并在发布清单注明。
- 本地代码收尾已完成，剩余发布门槛见 [RELEASE_READINESS.md](RELEASE_READINESS.md)；不擅自进入加密、云同步或其他阶段，也不宣称“应用正式发布完成”。

### Change 2026-10-10 / 安静自动保存与正文起点微调

- 目标：移除首页常态保存状态与防抖写入闪烁，正文略上移，保留必要失败/手动操作反馈；用户提到音效，本轮未新增音效或依赖，自动保存继续静默。
- 修改：删除首页保存状态行和状态圆点，使用固定的 writing-body 顶部留白（手机 3.25rem / 桌面 3.75rem）；手动保存草稿显示「已保存草稿」、正式保存和相机恢复沿用成功提示，但改为固定定位 2.4 秒轻提示，不参与正文排版。保存失败与加载失败仍可见。
- 文件：`src/views/Today/TodayView.vue`、新增 `tests/today-writing-presentation.test.js`；本文档、主题计划、发布清单、`design-qa.md` 和 `docs/design/qa/quiet-writing/` 浏览器截图。Android sync 的两个生成配置仅有换行统计差异，无语义改动。
- 数据影响：无 schema/migration、备份格式、日记/附件模型或 650ms 自动保存逻辑改动；不删库、不碰手机数据、不改代理、不提交或推送 Git。
- 验证：新增 7 项首页 SSR 展示测试；全量 22 文件 214 项通过，Vite build 131 模块、Capacitor Android sync、`assembleDebug --no-daemon` 通过（195 项任务）。390×844 正文 top 250→233px，日期底部始终 181px；320px 无横向溢出，1024px 正文距日期线 60px。手动草稿/正式保存前后 top 均为 233px，页面往返正文保留，浏览器 error 日志为空。
- 风险与边界：自动保存不再通过常态文字告知，但失败反馈、手动保存入口及草稿列表保留；本次不验证新的真机软键盘/读屏，也未运行 iOS 构建。历史真机证据仍注明对应日期；后续声音尝试已取消，不作为待开发事项。

### Change 2026-10-10 / 取消声音

- 用户决定不需要声音；移除本轮音效代码、设置入口及专用测试，试听文件和辅助脚本移出项目并保留可恢复副本。后续不以此前音色讨论作为需求依据。
- 保留首页去除常驻保存状态、正文上移和手动保存文字反馈。214 项测试、131 模块生产构建、Android sync 与 Debug 构建通过；APK 内入口文件与本轮 dist 一致。无 schema、migration、保存逻辑、依赖或数据库内容变化，无 Git 提交、代理修改或手机安装。

### Change 2026-10-11 / 上传项目与构建 iOS IPA

- 目标：按用户要求将当前项目上传既有 GitHub 仓库，并产出可供重新签名的 IPA。
- 上传：`main` 快进至构建提交 `fbef477`，包含首页安静写作调整、7 项展示测试和原有未跟踪的设计/验收文档及自有 QA 截图；不上传私人数据、工作区外备份、签名材料、依赖目录或编译缓存。没有强推或覆盖远端历史。
- 验证：本地 22 文件 214 项测试、Vite 131 模块构建通过；[Actions 第 3 次运行](https://github.com/zengxhzz/gentle-diary/actions/runs/38068796605)全绿，Xcode 16.4 archive 和模拟器启动通过。人工查看启动截图，无白屏；不冒充输入/权限/备份真机验收。
- 产物：`build/ios/run-3/gentle-diary-0.1.0-Release-3-unsigned.ipa`，2,176,723 字节，SHA-256 与云端清单一致；详情见 [IOS_BUILD.md](IOS_BUILD.md)。日志/截图下载至忽略的 `build/ios/run-3-diagnostics/`，自有启动截图另存 `docs/design/qa/ios/`。
- 涉及文件：本节、`docs/IOS_BUILD.md`、`docs/RELEASE_READINESS.md`、`docs/design/qa/ios/2026-10-11-simulator-startup.png`；既有构建工作流与脚本不改动。
- 数据与风险：本轮无 schema、migration、依赖、功能或用户数据变化。产物未签名，安装前需要同时重新签名 App 及嵌入 frameworks；尚无 iPhone 真机验收或正式发布。下一步为持有者签名并完成文档中的 iPhone 验证清单。仅记录结果的后续文档提交跳过重复 CI，不改变已构建的应用代码。

### Change 2026-10-11 / 寒蝉半圆体与正文字号

- 目标：按用户选中的真实字体预览，将日记输入改为更小、更圆润的寒蝉半圆体，保留写作优先布局。
- 修改：新增原版 ChillRoundM v1.805 TTF、离线 @font-face、正文字体/字号 token 和 OFL 声明；编辑/占位/详情/时间线/草稿摘要统一 16px。日期、按钮、装饰、正文起点和持久化逻辑不变，不新增字体设置入口。
- 文件：`src/assets/fonts/`、`src/styles/{fonts,base,tokens}.css`、`EditableParagraph.vue`、`DiaryTextEditor.vue`、`DiaryBlocks.vue`、`DiaryTimeline.vue`、`DraftsView.vue`、`public/licenses/ChillRoundM-OFL.txt`、`tests/diary-typography.test.js`，以及设计/计划/发布文档和 `docs/design/qa/typography/`。
- 数据模型与迁移：schema v3、备份 v2/v1、所有历史 migration 不变；无新依赖、数据库迁移或数据清理。浏览器使用独立 4189 origin 的自有示例，不访问私人记录。
- 验证：字体专项 9 项，全量 23 文件 223 项通过；Vite build 131 模块通过，打包字体和许可摘要与源文件一致。492×672 浏览器确认编辑和详情实际加载 ChillRoundM 16px / 33.6px，草稿往返、正式保存、时间线摘要通过，error 日志为空；选定预览与实装的 1:1 首行比较见 `design-qa.md`。
- 风险：原版字体增加约 6.52 MB，选择保留预览字形和原始授权信息；测试只确认示例中文/混合字符不为空白字形，不宣称全 Unicode 覆盖。原生键盘、系统大字号与不同机型尚未复测。
- 边界与下一步：未运行 Capacitor sync、Android/iOS 构建或手机安装，不提交/推送 Git，不改代理。现有 APK/IPA 不含新字体；下一步需重新打包后验证原生显示、输入法与系统字号，再继续既有发布清单。

### Change 2026-10-11 / 上传字体版并生成 IPA

- 用户随后明确要求上传 GitHub 并构建 IPA；字体提交 `10abe6cae9a66c20dafb147adaf6f366f4fcdd6a` 已普通快进推送到 main。此前字体实装阶段的未提交/未构建描述保留为历史边界。
- 本地再次通过 223 项测试与 131 模块构建；[Actions 第 4 次运行](https://github.com/zengxhzz/gentle-diary/actions/runs/38146350838)云端测试、iOS sync、Xcode 16.4 Release archive 与模拟器启动检查全部通过。
- 产物：`build/ios/run-4/gentle-diary-0.1.0-Release-4-unsigned.ipa`，5,710,319 字节，SHA-256 `B64DDEFBE47DA90C79951C36FA8D894AAAE587DD6657457509CB55FDE76DAE3A`，匹配云端清单。字体、完整 OFL、16px CSS 及包结构核对通过，详情见 iOS 构建文档。
- 涉及文件：本节、`docs/IOS_BUILD.md`、`docs/RELEASE_READINESS.md`、`docs/THEME_REDESIGN_PLAN.md` 与 QA 记录；现有构建脚本/工作流、依赖与数据库不变。IPA、日志、临时下载辅助脚本位于忽略的 `build/`，不进仓库，不上传签名材料或用户数据。
- 风险与下一步：IPA 未签名，需对 App 和嵌入 frameworks 重签名后安装；模拟器启动不代表 iPhone 真机输入/权限/备份通过。Android 字体版未构建，不改代理、不强推、不碰手机数据；下一步为持有者签名并验证字体、中文输入和既有发布矩阵。
