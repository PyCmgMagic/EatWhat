# EatWhat 前端

## 后端 v2

正式入口使用 [后端 v2 OpenAPI](../docs/EatWhat%20业务服务%20后端v2.openapi.json)，对应 `EatWhat-backend` 的 `8a89c8a`。契约含 139 项客户端操作和 8 项学校认证回跳，前端入口覆盖店铺推荐、附近、评价、收藏、账号及管理后台。

在 `frontend/` 下运行 `npm ci` 和 `npm run dev`。本地默认访问同源 `/api`。复制 `.env.example` 到 `.env.local`，将 `API_PROXY_TARGET` 设为包含 `/api` 的 v2 网关地址。生产静态部署使用同源 `/api`，也可通过 `VITE_API_BASE_URL` 指向已配置 CORS 的 v2 网关。

学校认证的前端回跳可设为站点的 /home。邮箱验证页可将后端 APP_EMAIL_VERIFY_URL 设为站点的 /verify/email。两个路径都需要站点的静态路由回退，前端启动时会读取并移除地址栏票据。对象存储允许前端域名 PUT，并按签名指定的 Content-Type 发送文件。

演示入口为 /?demo=1。新的浏览器上下文可用 /?demo=1&persona=admin#/admin 或 /?demo=1&persona=unverified 切换初始身份。演示手机号为 13800000001（认证）、13800000002（管理员）、13800000003（未认证），验证码和初始密码均为 123456。正式和演示会话分开存储。历史画板入口为 /#/design。

`npm run api:generate` 生成客户端类型、操作和权限规则。`npm run api:audit` 校验生成结果。`npm test` 运行测试，`npm run build` 检查类型并输出前端 ZIP。

从仓库根目录运行以下命令。脚本拦截业务网络，使用本地演示和模拟响应检查请求参数。

```powershell
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-v2 open "http://127.0.0.1:5173/?demo=1"
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-v2 run-code --filename frontend/scripts/backend-v2-flows.js
```

## 网页一键登录排查

复现失败后，在浏览器控制台筛选 `phone_auth_`。将 `phone_auth_error` 对象及相同 `trace` 的 `phone_auth_timing` 日志交给阿里云支持；正式构建也保留这些日志。

进入手机登录页时先显示短信验证码表单，随后在后台检测一键登录：先用 SDK 的 `getConnection()` 排除 Wi-Fi，再调用 `checkLoginAvailable`，可用则自动弹出运营商授权页。任何一步失败都静默处理，不弹提示，继续使用短信验证码登录；诊断只写入浏览器控制台。

错误日志包含时间、SDK 版本、失败阶段、运营商错误码、浏览器版本及网络状态；提供商返回符合 UUID/十六进制格式的 `requestId`、`msgId`、`carrierTraceId` 时也会保留。运营商错误消息只归类为超时、网络或脚本错误，不输出原文、手机号、页面地址或认证凭据。未获得提供商 ID 时，可结合时间和本地 `trace` 排查。

## APIv7 历史记录

以下保留前一版前端和旧接口的开发记录。

React 19、TypeScript、Vite、React Router、TanStack Query。当前移动端以 `../prototype/` 的本地画板为设计来源；旧 `design/` 不再作为移动端基准。51 张 HTML 画板编译为 React 页面，复用原始 CSS、SVG 插画、MingCute 图标、九种舞台色，以及本地托管的 Noto Sans SC 和 Bricolage Grotesque 字体。

前端提供移动、平板和桌面布局。自动模式下，视口不足 640px 使用移动端，640–1023px 使用平板布局，从 1024px 开始使用桌面布局。详见 [PC 设计说明](../docs/PC端设计与实现.md)。

桌面导航、页脚及首页/附近浏览区随窗口扩展，最大宽度 2304px；详情、账号和表单内容保留 1360px 阅读宽度。附近地图使用扣除导航、标题和页脚后的可用高度，首页舞台与卡片在大屏按各自上下限调整尺寸。详情图片区按可用窗口高度设定上下限，圆盘最大 420px，保留靠右、局部出框的构图；详情在 900px 以下改为上下排布。长标题、标签和描述自然撑开文档，图片尺寸独立受限，加载骨架使用相同高度预算。以 CSS 视口宽高适配窗口和浏览器缩放，不使用整页 `zoom` 或按设备分辨率等比放大。`scripts/browser-dish-responsive.js` 覆盖短窗口、平板、大屏、长内容和图片切换。

`scripts/browser-wide-layout.js` 覆盖首页与附近页在 600–2560px 视口下的空间利用、短窗口、地图加载与选店、圆形图片及靠右构图，并确认详情和登录表单仍保持阅读宽度。

发布页选好餐厅后，选店区自动收起为店名、地址和「更换」入口，已有选店的草稿进入时直接显示摘要；展开后可继续搜索、改选和添加新店。收展保留菜品草稿，收起内容退出键盘导航；减少动态效果与键盘操作即时切换。`scripts/publish-shop-collapse.js` 覆盖 600/820/1062/1440px 的收展、搜索改选、已有选择、失败恢复和草稿保留。

发布个人标签支持回车或点击「添加」，已添加项显示为带移除按钮的标签块，并显示已添加数量。支持重复过滤和批量粘贴，最多 20 个、每个 1–10 个 Unicode 字符；不通过回车触发发布。输入与标签都保留在当前发布草稿中，发布会合并尚未点击添加的输入，失败后仍可继续编辑。`scripts/publish-tags.js` 覆盖输入法、添加删除、限制、布局和草稿恢复，`scripts/toast-feedback.js` 校验最终提交的标签及失败重试。

界面文案默认只保留标题，不自动补充副标题或口号。只有提供操作条件、范围、限制或结果说明时才增加辅助文字，直接描述事实；避免重复标题和按钮已经表达的信息。

新用户统一通过手机号验证码注册，已有用户名、邮箱或手机号账号继续使用密码登录。桌面弹窗、独立页面和手机版的注册入口均指向 `/auth/register`；旧 `/auth/username-register` 链接自动跳转并保留返回目标，不再展示用户名注册表单或调用已默认关闭的注册接口。手机号注册成功后的设置登录名属于已登录账号设置。

## 启动

```powershell
Set-Location D:\项目\EatWhat\frontend
npm ci
npm run dev
```

- 本地开发默认真实接口：<http://127.0.0.1:5173/>
- 显式 Mock：<http://127.0.0.1:5173/?demo=1>
- PC 设计预览：<http://127.0.0.1:5173/?demo=1&view=desktop>
- 移动端对照：<http://127.0.0.1:5173/?demo=1&view=mobile>
- 全部画板：<http://127.0.0.1:5173/?demo=1#/design>
- 原始样例对照：`/?demo=1#/reference/G2-Home`
- 真实接口模式：<http://127.0.0.1:5173/?demo=0>
- 管理演示：`/?demo=1&persona=admin#/admin`
- 未认证演示：`/?demo=1&persona=unverified#/favorites`

本地开发默认使用真实接口，桌面和移动端共用当前账号与数据；没有登录时显示登录入口，接口失败显示错误和重试，不回退样例内容。只有显式使用 `?demo=1` 才启用独立 Mock 数据并自动进入模拟学生账号，不需要后端或真实账号。演示账号主动退出后，登录页可点击「一键 Mock 登录」，刷新也会保留退出状态。演示中的收藏、标签、发布和资料修改保存在本机，不发送真实邮件、短信或业务写请求。桌面右侧提供演示身份切换，手机宽度保留原有画板。`?demo=0` 保持真实接口模式。生产默认关闭演示，独立演示构建需设置 `VITE_ENABLE_DEMO=true` 并使用 `?demo=1`。

```powershell
npm run prototype:generate  # prototype 更新后重新生成，需 Python 3 标准库
npm run api:generate        # 从 ../docs/EatWhat 业务服务 APIv7.openapi.json 生成类型
npm run typecheck
npm test
pnpm build                  # 清理旧 dist、构建并生成时间戳 ZIP
npm run preview             # 生产产物，5174
```

`pnpm build`（或 `npm run build`）会先检查 TypeScript，再删除旧 `dist/` 并重新构建，最后将 `dist/` 内的全部文件压缩到项目根目录的 `output/packages/YYYYMMDD-HHmmss.zip`，时间采用北京时间。ZIP 根目录直接包含 `index.html`、`assets/` 和 `.vite/manifest.json` 等部署文件。

新包完整生成后，仅清理 `output/packages/` 中符合该时间戳命名的旧 ZIP，保留最新一份；构建或压缩失败时保留上次的 ZIP。`dist/` 保留供本地预览使用。输出目录已被 Git 忽略。

生成内容在 `src/mobile/generated/`，资源在 `public/prototype/assets/`，业务适配在 `src/mobile/bridge.tsx`，不要直接修改生成文件。画板结构调整后需检查适配层中的节点编号。前端运行和生产构建不依赖 Python 或 Claude Design 服务。

菜品插画沿用原型的俯视餐盘、青花描边和柔和食材配色，统一通过 `DishIllustration` 使用。新增蛋炒饭与小笼包 SVG 放在 `public/assets/dishes/`，用于成长、足迹和帮助等页面；应用位置与补画规则见 [菜品 SVG 使用约定](../docs/菜品SVG使用约定.md)。插画不作为真实菜品照片的替代。

## 操作权限的统一入口

操作成功、失败与表单校验统一通过顶部 toast 提示，入口为 `useApp().toast(message, { tone })`，支持 `info`、`success`、`error`。共用 `useTask`、`useCommand` 和自定义表单的 `useFeedbackState` 会在操作时发送提示；不要再额外渲染一份行内错误条。toast 在当前视口显示，登录、裁剪和确认弹窗内也可见，支持关闭、悬停暂停与相同错误重试。页面加载失败的重试状态、发布结果待核实的操作入口及确认对话框继续作为页面功能保留。

`scripts/toast-feedback.js` 隔离验证 320/390/1440px 登录错误、弹窗层级、重复错误、发布上传失败、滚动可见性、草稿保留及成功重试；`src/app/toast.test.tsx` 覆盖提示计时、去重、关闭、弹窗容器与权限提示抑制。

业务组件直接调用 `useApp().api`。请求层 `src/api/access.ts` 根据统一规则，在受保护的写请求发出前处理登录和学生认证；认证弹窗、返回地址及取消后的焦点恢复由根级 `ActionAccessPrompts` 处理。页面无需逐个添加认证判断。打开编辑器或选择面板前如需提前提示，可用 `useActionAccess({ path, options })` 查询同一规则。

规则来自 APIv7 契约的权限声明与公开/可选登录说明，保存为 `src/api/access-rules.generated.ts`。`npm run api:generate` 同步生成类型和权限；`npm run api:access` 单独更新权限，`npm run api:access:check` 检查是否与契约一致，构建也会执行此检查。上传按 `biz` 区分：头像、反馈只需登录，菜品、店铺、活动和评论图片需要学生认证。取消收藏等操作保留契约规定的登录要求。

被拦截的操作抛出 `AccessRequiredError`，不会返回成功或在认证后自动重试。公共任务组件会隐藏已由弹窗处理的重复错误；调用方不要把该异常转换为成功结果。后台读取继续使用页面权限状态，避免刷新数据时主动弹窗。服务端明确返回“用户未验证”时也会统一引导；一般 403、管理员权限、封禁、验证码和其他业务状态错误不归为学生认证。服务端仍负责最终授权。

网页学生认证的服务端回调固定为 `/home?result=success|failure&code=...`。应用启动前统一转换为 `/#/verify?result=...&code=...`，显示认证结果并重新查询 `/user/info`，不凭 URL 判定认证成功。发起认证时短期保存账号 ID 和站内来源地址，支持 `noopener` 新标签页回调及结果页刷新；成功后可返回原页面，无来源时返回账号与安全。来源记录不含令牌或学校凭据，30 分钟过期，账号不匹配时不恢复。原认证页面重新获得焦点时也会刷新状态。

## 当前交付验证（2026-11-10）

- 61 个测试文件、515 项测试通过；TypeScript、权限规则、201 项客户端 API 覆盖检查与生产构建通过。
- `/admin` 使用独立后台布局，16 个管理模块统一导航；桌面显示侧栏，手机使用抽屉。前台桌面页头和手机个人中心提供管理员专属入口，后台页头可返回前台，保留会话和两侧位置。旧 `/admin?tab=…`、`/admin/v4?tab=…` 链接自动迁移并保留查询条件。
- `scripts/admin-workspace.js` 验证 360/390/768/1280/1440px、16 个模块、切换与状态保留、抽屉键盘操作、旧链接及游客/普通用户拒绝访问；`scripts/api-v7.js` 回归评论、回复、点赞、审核公开和本人删除。均使用隔离演示，零真实业务请求。细节见 [独立后台与前后台切换](../docs/独立后台与前后台切换-20261110.md)。
- APIv7 评论、晒图、我的评论及等级字段接入见 [APIv7 接入与验收](../docs/APIv7接入与验收-20261110.md)。真实账号与后端写入流程仍需测试环境联调。

## 前次交付验证（2026-11-09）

- 50 个测试文件、431 项单元与契约测试通过，TypeScript 检查、权限规则与契约一致性检查、生产构建通过。
- 首页恢复移动端圆盘绕圈切换，展示完整推荐结果，桌面舞台高度随窗口适配；缺失或加载失败的菜品图片使用明确标注的 SVG 兜底。移动端底栏使用玻璃质感，成长信息并入个人页头部，浏览器标题使用产品名称。
- 新建店铺支持地图选点、拖动微调、逆地理地址建议及百度店名实时匹配；桌面地图支持鼠标拖动与滚轮缩放。附近页压缩标题、搜索区和店铺浮卡，左侧列表在已验证的桌面尺寸下完整显示 4–6 家店，手机沿用可拖动面板。相关脚本为 `restaurant-location-picker.js`、`restaurant-place-search.js`、`real-map-flows.js`。
- 设置与编辑资料统一布局，设置分组标题收进卡片，功能搜索入口移到侧栏账号下方；账号加载与页面代码加载均使用匹配实际布局的骨架屏。`desktop-profile.js`、`profile-edit-return.js`、`settings-loading.js` 覆盖编辑、返回路径和加载状态。
- 编辑菜品使用统一照片网格，支持多选、拖入、删除、大图预览及数量/格式/大小校验；添加副图保留封面裁剪，保存失败后重试复用已上传图片。`food-photo-picker.js` 覆盖 7 种宽度和隔离上传保存流程；`food-photo-fallback.js`、`mobile-home-orbit.js` 分别验证图片兜底与首页转盘。
- APIv6 成长页、经验流水分页和管理端活跃统计已接入；前台活动统一上报并限频。设置登录名按返回值保留会话，注销默认匿名保留内容并可明确选择删除，菜品作者优先使用新 `user` 对象。`scripts/api-v6.js` 隔离验证手机和桌面流程。
- 移动端统一浮动导航、登录与个人中心、设置子页；首页、详情、附近列表等面板支持拖动。通知偏好明确显示带菜品 SVG 的「敬请期待」，暂不调用推送接口。
- 桌面和移动端进入附近页自动发起定位，成功后用当前位置查询店铺；拒绝或超时保留区域选择和手动重试。搜索重绘不重复请求，离开页面或手选新区域后忽略迟到结果；店铺位置编辑器保持手动定位。
- 地图使用 24px 店铺图钉，选中店铺突出颜色并显示完整店名，普通店名按空间避让；密集店铺显示「N 家」并可点击放大，同坐标或最高缩放仍重叠的店铺展开选择列表。照片保留在店铺卡片中。聚合范围为当前查询结果页；`scripts/map-markers.js` 在 320/390/820/1440px 验证真实地图交互，`map-markers.test.ts` 覆盖聚合与标签避让。
- 需要登录或学生认证的操作由请求层统一提示；学生认证解释两种方式任选其一，并保留来源页面，认证结果重新查询账号状态。
- 发布流程修复裁剪预览不一致、餐厅名称未显示、个人标签添加后不可见及输入丢失；本地 R2 上传代理为可选开发配置，生产仍使用直传和存储桶 CORS。
- 浏览器验证覆盖 320/390/520px 手机布局与桌面、触摸拖动、失败重试及隔离的模拟发布。业务写请求使用模拟接口；地图交互使用真实百度地图只读资源。说明及脚本索引见 [本轮修复与验证](../docs/移动端体验修复与验证-20261108.md)。
- 本地环境文件、浏览器会话、截图、日志和构建 ZIP 不提交到 Git。完整真实账号业务流程和生产部署仍需在目标环境验收。

`../output/`、`output/` 和 `dist/` 为本地产物目录，不纳入 Git；下文引用的报告、截图及日志是运行验收脚本后生成的本地记录。`scripts/` 中的可复用验收脚本及 `src/` 中的测试继续纳入版本管理。历史日期段落保留当时的测试数量与边界，以最新交付验证为准。

## 配置后端

首页推荐 `/foods/recommend` 的线上响应为 `data: [...]`；当前本地 APIv6 契约仍描述为 `data.items` 分页对象。前端适配层兼容这两种响应，演示推荐使用数组格式；无法识别的数据结构会显示错误，不再静默当成空推荐。

推荐回归脚本为 `scripts/home-recommendations.js`（桌面数组/分页格式、分类、刷新和错误恢复）与 `scripts/mobile-home-empty.js`（手机三种宽度的空态、失败重试及数组响应恢复），均使用独立浏览器上下文并拦截业务请求。

登录会话使用 `localStorage`，同一浏览器、同一源（协议、域名和端口一致）的新标签页会继承登录，已打开的标签页同步登录、退出和过期状态。真实会话与演示会话分别保存；首次加载新版时会迁移当前标签页原有的 `sessionStorage` 登录，已有共享登录或退出记录优先。退出后保留值为 `null` 的标记，防止旧标签页重新导入失效凭证。草稿和管理页面导航状态仍按标签页隔离。

多标签页验收使用 `scripts/session-sync.js`（Playwright CLI `run-code --filename`，运行方式见下文），在独立浏览器上下文中拦截全部业务请求，覆盖迁移、新标签页、账号切换、退出、过期、旧请求竞态及演示隔离。

复制 `.env.example` 为 `.env.local`，配置可用测试环境后重启服务。现行契约为 `../docs/EatWhat 业务服务 APIv7.openapi.json`（内部版本号尚未更新，以文件和操作差异识别），旧版契约保留作历史对照。224 项操作中，201 项客户端操作全部已有封装，另有 9 项后端回调和 14 项此前明确排除的活动操作。APIv7 新增评论、回复、晒图、个人提交、点赞及评论审核，并在用户资料返回等级与经验，详见 [APIv7 接入与验收](../docs/APIv7接入与验收-20261110.md)。APIv6 已接入成长、经验记录与管理端活跃统计，接入范围和验收见 [APIv6 规划与验收](../docs/APIv6接入规划与验收-20261108.md)。APIv5 已移除发布请求中的 `removeBackground` 和管理配置中的 `autoCutout`，生成类型和演示数据同步更新。功能导航为 `/?demo=1#/features`，管理页面为 `/?demo=1&persona=admin#/admin`，旧管理链接继续兼容。接入及部署边界见 [APIv4 接入与验收](../docs/APIv4接入与验收-20261102.md)。

当前本机已配置 `API_PROXY_TARGET=https://eat.v50to.you/api`，浏览器请求同源 `/api`。例如 `/api/foods/list` 转发为 `https://eat.v50to.you/api/foods/list`，内层控制器前缀继续保留。新域名的连通性记录见 [后端地址与连通性](../docs/后端地址与连通性-20261023.md)。直接跨域部署时需检查 CORS，详见 [APIv2 接入与验收](../docs/APIv2接入与验收-20261026.md)。

图片上传是另一条链路：`presign` 成功后仍需要向 R2 PUT 图片。开发服务可通过 `UPLOAD_PROXY_TARGET` 启用固定桶的同源上传代理；生产包和 preview 不使用此代理，必须配置 R2 桶的 CORS。配置文件、适用范围及验收步骤见 [R2 图片上传与 CORS](../docs/R2图片上传与CORS.md)。

所有图片在申请上传凭证之前统一压缩（包括批量上传和演示模式）：普通图片最长边 1920px、最大 1MiB，头像最长边 768px、最大 256KiB，保持宽高比且不放大。JPEG 保持 JPEG，PNG/WebP 优先输出保留透明区域的 WebP，不支持 WebP 编码时使用 PNG。尺寸符合限制且小于 128KiB 的图片直接保留；压缩失败时提示重试。签名的文件名、类型、大小与实际上传的压缩文件一致。现有 JPG/PNG/WebP 和单张原图 10MB 的选择限制继续适用。

| 变量                  | 含义                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `VITE_API_BASE_URL`   | API 前缀，默认 `/api`                                                    |
| `API_PROXY_TARGET`    | Vite 开发/预览代理，支持完整网关路径，当前为 `https://eat.v50to.you/api` |
| `VITE_MEDIA_BASE_URL` | 图片 key 永久读取前缀，不能用上传签名地址代替                            |
| 学校认证地址          | 由 POST `/auth/sdu` 返回，无需固定入口配置，不拼入应用 token             |
| `VITE_ENABLE_DEMO`    | 生产演示包开关                                                           |
| `VITE_BAIDU_MAP_AK`   | 百度地图 JavaScript API 浏览器端 AK，存放在 `.env.local`                 |

Hash 路由支持刷新详情。开发和 Vite preview 均使用同源代理；生产静态托管仍需配置同源 API 反向代理及存储 CORS。控制器 `/api/location/...` 的内层前缀必须保留。

保留原有 API 约定：动态 tokenName 请求头、Bearer tokenValue；非零业务码失败；401 清会话，403 保留会话；临时授权凭证不当作登录；presign → 原始 PUT → complete → 保存 key，存储 PUT 不带应用 token。当前创建返回 `{ id, moderationStatus, revisionId }`；有 revisionId 时进入私有提交进度，无私有修订时使用准确 ID 继续详情或发布。成功响应缺少有效 ID 时按结果不确定处理，暂停重复创建。

## 单站登录与认证

2026-11-08 已移除双站时期的跨站授权：登录、注册与验证码发送不再读取政策或等待勾选；设置与后台不再提供跨站授权、政策配置及同步工作台。旧授权地址自动返回登录或账号设置。学生认证、隐私设置、使用统计的自主授权保持独立。服务端仍公开旧政策接口，APIv6 原始契约与兼容适配保留，但业务页面不调用；不自动补填同意字段，也不将旧 proof 当成会话。详见 [单站清理记录](../docs/单站跨站功能清理-20261108.md)。

历史 APIv2 迁移覆盖 117 项客户端操作，另有 5 项后端回调、14 项按约定排除的活动操作。已新增首次设置登录名、TA 的分享、足迹清空、个性化推荐、屏蔽管理、密码冲突恢复、政策配置及账号安全复核。该阶段的资料裁决保护已在 APIv4 升级时替换为 expectedRevision/selectedHeadId 裁决。详见 [APIv2 接入与验收](../docs/APIv2接入与验收-20261026.md)。

验证码发送统一接入腾讯国际站 CAPTCHA，原六类发送方法及新增手机号换绑发送在每次操作时读取新的 no-store 配置；SDK 按需加载，不进入首页请求。取消、失败、过期或路由卸载均丢弃本次票据；业务成功后才启动倒计时。Mock 使用独立模拟弹层，点击“完成验证”后短信码为 `123456`；恢复邮件的演示令牌为 `demo-recovery-token`，不会发送真实短信或邮件。

```powershell
npm run api:audit           # 全量接口分类及源码消费位置
npm run api:diff            # APIv6 → APIv7 接口与模型差异
```

APIv2 历史回归脚本为 `scripts/api-v2-flows.js`、`api-v2-mobile-flows.js`、`api-v2-admin-responsive.js`、`api-v2-live-contract.js`、`api-v2-production.js`，均隔离真实写入。生产检查需先执行 `npm run build` 与 `npm run preview`。历史 `latest-api-*` 和 APIv2 记录继续保留，当前契约为 APIv7，覆盖及差异报告分别为 `../output/api-v7-coverage-20261110.json` 和 `../output/api-v7-diff-20261110.json`。

APIv3 的授权状态查询仅返回 `status`、`identityReady`、`policyVersion`，该旧授权面板与恢复流程已于单站清理时移除，协议适配仅用于历史契约核对。Mock 查询同样只返回三字段，兼容旧本地记录并保留上传。历史 APIv4 的 `loginId` 支持字符串或数值，当前 APIv7 已收窄为字符串。APIv3 历史覆盖记录为 `../output/api-coverage-20261102.json`，差异记录为 `../output/api-v3-diff-20261102.json`，浏览器专项为 `scripts/api-v3-consent.js`。

类型生成统一使用 `npm run api:generate`，读取 APIv7 OpenAPI JSON，并兼容历史 `$ref` 的 nullable 标记。

## 当前功能

- 三栏悬浮导航、转盘与舞台过渡；校区/饭点/分类推荐、换一批、游客 deviceId 与手动口味偏好。
- 全站菜品搜索、分类/预算/区域/排序；无需定位的店铺浏览；服务端完整收藏分类筛选。
- 菜品和餐厅详情、点赞收藏、公共与个人标签、分类改名删除；已认证作者可编辑和删除自己的菜品。
- 选店、圆形取景和缩放、JPEG 裁剪、九色建议、零元价格；初始标签、舞台色、候选色、饭点和裁剪信息随创建保存。草稿在当前会话内跨页保留，成功后清空。
- 密码与手机验证码登录、手机自动注册、用户名注册、邮箱及学校认证、资料头像、补充资料、密码首次设置/修改、手机绑定、关注粉丝、历史、隐私、消息。
- 保留管理员维护页面。管理操作遵守服务端 admin 与对应认证要求；游客可浏览公开内容，收藏要求登录，写入标签/点赞/发布仍要求学生认证。

举报、反馈、设备、换绑、注销、通知偏好和专题已按现行协议接入，真实可用性依赖后端部署及账号联调。评论、回复、晒图、点赞、提交记录、删除与审核已按 APIv7 接入。常规找回密码支持先手机登录再设置密码；密码冲突恢复另有邮件申请与令牌重置入口。地图已接入百度地图官方 JSAPI 4.0，支持拖动缩放、设备定位、按后端坐标展示店铺及新店选点；缺失坐标的店铺只保留在列表中。手机裁剪页已移除自动去背景入口，普通照片按圆盘样式展示。舞台色读取优先使用云端字段，兼容旧本地记录。地图配置、坐标处理与验收见 [真实地图接入](../docs/真实地图接入-20261030.md)。

详见 [还原说明](../docs/移动端原型还原与实现.md)。尚未使用真实后端账号完成端到端联调。

历史 `latest-api-consent*`、`api-v3-consent.js` 等双站专项只用于当时版本，不再适用于单站 UI。当前登录与旧链接回归使用 `scripts/single-site-auth.js`，所有请求在浏览器测试中隔离，不发送真实短信或写入真实账号。

## 浏览器验收

2026-10-24 性能优化：首屏 JavaScript 的完整静态依赖约从 1.15 MB 降至 585 KB，原始画板与控制器文件不改动，51 张画板由 `config/prototype-data.ts` 在构建时拆成按需模块。后台及主要二级页延迟加载，React 独立缓存，公共样式先于响应式覆盖载入。手机首页只请求当前画板，桌面首页不请求画板和后台代码。附近与手机选店搜索防抖 250ms、清空即时生效；列表图延迟加载和异步解码。视口 CSS 更新按帧合并并跳过相同值，断点路由仍即时切换。`scripts/measure-build.mjs` 统计入口全部静态依赖及统一 gzip 估算；`scripts/desktop-performance.js` 验证按需请求、51 张画板、搜索次数及生产页面；`scripts/report-performance.mjs` 汇总报告到 `../output/performance-validation.json`。体积统计为标准生产构建，浏览器检查使用隔离 Mock，没有真实后端写入，也不将本地加载时间换算成真实网络速度提升。

2026-10-24 加载体验：主要页面使用与内容形状接近的静态骨架，首页加载前后保留校区工具栏，手机骨架保留原位导航；店铺菜单、菜品地址和个人统计单独占位。加载、成功无数据、首次失败分开处理，后台刷新及刷新失败保留已有内容，附近筛选保留上一组结果并标注更新状态。已有查询缓存继续复用；详情 GET 会记录足迹，因此不在悬停时预取详情。`scripts/desktop-loading.js` 使用 1–2.5 秒延迟的 Mock 检查 390/820/1440px 下的 27 个冷启动组合，另测地址分批到达、缓存返回、后台失败及重试。记录生成器为 `scripts/report-loading.mjs`，报告为 `../output/loading-validation.json`，截图为 `../output/playwright/loading-*.png`。静态骨架没有循环动效；该测试不代表实体设备或真实后端延迟验收。

新版验收脚本在仓库根目录执行，使用独立 Playwright CLI 浏览器：

```powershell
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-latest open "http://127.0.0.1:5173/?demo=1"
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-latest run-code --filename frontend/scripts/latest-api-ui.js
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-latest run-code --filename frontend/scripts/latest-api-contract.js
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-latest run-code --filename frontend/scripts/latest-api-mobile.js
# 移动端脚本出现文件选择器后执行，脚本会继续完成流程并恢复 Mock 数据
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-latest upload prototype/assets/photos/sq_luosi.png
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-latest run-code "async page=>JSON.parse(await page.evaluate(()=>sessionStorage.getItem('eatwhat-qa-latest-mobile')))"
# npm run preview 启动 5174 后，检查生产默认禁用 Mock
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-latest run-code --filename frontend/scripts/latest-api-production.js
```

18 个测试文件、89 项单元/契约测试通过（含网关路径、政策同意、9 项动效生命周期、7 项食友路由与隐私保护及 6 项响应式布局规则测试）。`latest-api-ui.js` 验证 Mock 主流程和 28 项新页面宽度检查；`latest-api-contract.js` 通过真实适配层的 62 次拦截请求，不访问远程后端；`latest-api-mobile.js` 补查原型选店、裁剪、标签、作者编辑删除和新店带入。截图在 `../output/playwright/latest-*.png`。

以下为此前原型与桌面适配的历史验收命令。部分脚本仍保留旧创建跳转、旧资料清空与旧待接入入口的断言；新版协议相关验收应使用上述脚本。

```powershell
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-mobile open "http://127.0.0.1:5173/?demo=1"
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-mobile run-code --filename frontend/scripts/prototype-artboards.js
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-mobile run-code --filename frontend/scripts/prototype-business.js
# 文件选择器出现后执行，脚本会继续裁剪和发布
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-mobile upload prototype/assets/photos/sq_luosi.png
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-mobile run-code --filename frontend/scripts/prototype-profile.js
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-mobile run-code --filename frontend/scripts/prototype-api.js
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-mobile run-code --filename frontend/scripts/prototype-cleanup.js
npx --yes --package @playwright/cli playwright-cli -s=eatwhat-mobile run-code --filename frontend/scripts/prototype-routes.js
```

截图在 `../output/prototype/`。接口测试拦截全部业务请求，不访问远程服务。cleanup 只清理独立演示中脚本创建的固定测试菜名和测试标签。旧 `browser-*.js` 属于前一版界面，仅供历史参考。

PC 验收使用 `scripts/desktop-smoke.js`、`scripts/desktop-workflow.js`、`scripts/desktop-final.js`，命令格式同上。PC 截图位于 `../output/playwright/pc-*.png`。移动端旧脚本需在手机宽度或 `view=mobile` 下运行；PC 在桌面宽度自动启用。

PC 发布已改为同页工作区，选店、图片、菜品信息与发布在一页完成，裁剪使用原生弹窗。支持照片拖放、多图管理、设为封面、搜索并改选餐厅和暂存返回。草稿跨页面保留，刷新会清空。使用 `scripts/desktop-composer.js`、`scripts/desktop-composer-api.js`、`scripts/desktop-composer-context.js` 验收完整流程、失败恢复和餐厅上下文，文件直接设置到输入框，不需要手动 upload。API 验收拦截全部真实请求。运行前可用 `prototype-cleanup.js` 清理固定测试菜品，发布脚本成功后会自行清理。

Mock 登录专项使用 `scripts/mock-login.js`（同样在仓库根目录运行）。覆盖默认登录、退出刷新、PC/移动端一键登录、目标页恢复、会话隔离及生产禁用，拦截真实 API；生产检查需同时启动 5174 预览服务。截图为 `../output/playwright/mock-login-*.png`。

PC 标签切换专项使用 `scripts/desktop-tabs.js`，覆盖主导航、首页分类、上传/收藏、快速切换、键盘、减少动态效果和响应式指示器对齐。共享节奏与生命周期由 `src/motion/` 管理，`src/desktop/motion.tsx` 提供标签滑块与内容容器。

全站动效专项为 `scripts/desktop-motion-all.js`、`scripts/desktop-motion-surfaces.js`、`scripts/desktop-motion-touch.js`，命令格式同上。覆盖按钮按压、卡片内图片悬停、PC 跟手拖动、移动端 360ms 转盘、稳定的圆点和分类栏、页面/列表切换、弹窗完整进出场、消息退出文字保留、焦点恢复和滚动锁定；减少动态效果运行时生效，键盘导航即时响应。触屏检查使用独立浏览器上下文，尚未进行实体手机验收。主流程覆盖 8 种宽度 × 6 个页面，记录为 `../output/motion-validation.json`，截图为 `../output/playwright/motion-*.png`。原型生成文件保持原样，适配在 bridge 与共享样式中完成。顶部推荐与分类结果独立，空分类不会移除首页与切换入口。没有新增动效库。

PC 编辑资料与设置页共用页头和分组卡片，头像、昵称、签名、性别和生日同页保存。`/me/details` 同样进入完整编辑页。头像先裁剪和预览，保存时再上传，失败会保留修改并复用已上传 key。专项检查见 `scripts/desktop-profile.js` 和 `scripts/desktop-profile-api.js`。清空已填写的性别或生日时，页面会提示填写有效值或取消修改。

菜品上传照片采用与默认插画一致的圆盘布局和浅色舞台背景，列表中不再铺满卡片；图片来源参与插画识别，重名上传图不会被误判。专项使用 `scripts/desktop-food-photos.js`，覆盖四种桌面宽度、推荐与详情、移动端，完成后恢复脚本使用的演示数据。

PC 评论整合到 `/foods/:id` 的页内讨论区，右侧保留当前菜品和编辑框。Mock 支持本地图文评论、回复、点赞、排序、刷新恢复与我的评论索引；旧评论入口进入相应菜品，真实模式禁用提交，不调用缺少的评论接口。运行 `scripts/desktop-discussion.js`、`scripts/desktop-discussion-api.js` 验证，演示评论单独存放在 `eatwhat-demo-comments-v1`，验收结束会恢复原记录。移动端原型流程保持不变。

PC `/me/tags`、`/history` 使用个人中心侧栏，分别为双列标签管理卡片和按日期分组的双列足迹。标签支持就地重命名、删除确认与失败重试；足迹支持菜品/店铺切换、分页、本页筛选与失效记录保护。标签从菜品详情或发布初始标签创建，收藏标签现已查询全部收藏，足迹清空暂无接口。历史布局验收为 `scripts/desktop-library.js`、`scripts/desktop-library-api.js`，截图在 `../output/playwright/pc-library-*.png`。Mock 店铺足迹仅记录直接进入店铺页的访问，旧菜品足迹继续兼容。

PC 二级页面已补齐专门布局，覆盖设置与认证、通知、食友主页、关注列表、新建店铺、登录注册和说明页。新建店铺及补充位置合并同页填写，提交返回 Void 后回到选店；失败保留输入，结果未知时跨页面暂停重复创建。12 个待接入入口有明确的开放状态与可用跳转。历史 `scripts/desktop-secondary.js` 检查 28 个入口 × 四种桌面宽度及移动端回归；其中整体缩放预览已由下述响应式布局替代。`scripts/desktop-secondary-api.js` 拦截 36 次请求验证操作、防重和失败恢复，无远程请求。截图为 `../output/playwright/pc-secondary-*.png`，完整清单见 [PC 适配审计](../docs/PC端适配审计.md)。

关注与粉丝现已整合到个人主页：PC 使用双列食友弹层，手机使用单列底部面板，点击数量就地打开，关闭后保留原来的主页内容。自己的入口为 `/me?people=fans` 或 `/me?people=follow`，他人的入口为 `/users/:id?people=...`；旧 `/follows?tab=...&userId=...` 自动转到对应主页。分页、本页搜索、隐私保护、失败重试和浏览器前进后退均保留，点击食友后返回可恢复列表。移动端他人主页的菜单默认收起，设计对照模式保持原样。当前专项为 `scripts/desktop-profile-people.js` 和 `scripts/desktop-profile-people-touch.js`；旧二级页脚本中独立关注页面的断言已过时。记录为 `../output/profile-people-validation.json`，截图为 `../output/playwright/profile-people-desktop.png`、`profile-people-mobile.png`。触屏为浏览器模拟。

平板个人中心使用窄左栏和独立内容区，概览卡集中显示头像、资料和统计。移动画板最多宽 520px，宽窗口内居中。`view=desktop`、`view=mobile` 和原型对照入口可用于预览。登录和资料编辑随视口切换并保留输入。发布、新建店铺、修改菜品或店铺和写评论沿用进入流程时的界面控制器，避免窗口缩放或旋转清空输入。

`scripts/desktop-responsive.js` 检查 201 个页面与视口组合（11 种主要宽度、13 个主要 PC 页面、自动切换及横屏弹层）；`scripts/desktop-responsive-interactions.js` 通过 8 组跨断点操作，`scripts/desktop-tabs.js` 的 7 组回归通过。无横向溢出、页头重叠、页面异常或真实 API 请求。记录见 `../output/responsive-validation.json`，截图为 `../output/playwright/responsive-*.png`。验收使用独立 Chrome 和触屏模拟，实体手机和其他浏览器仍需最终验收。

2026-10-24 手机与平板补查：`scripts/desktop-mobile-tablet-audit.js` 覆盖 44 个页面 × 9 种尺寸（396 组，包含短屏和横屏）；`scripts/desktop-mobile-tablet-flows.js` 通过 6 组专项，覆盖选店列表末项、评论滚动、地图全部标记、600px 断点、16 组长文本及模拟键盘避让。修复选店遮挡与选中对比度、食友装饰图溢出、地图选中卡片遮挡、手机表单宽度、完整菜名与长地址展示。`src/app/viewport.ts` 根据可视视口调整食友、标签和政策弹层。报告见 `../output/mobile-tablet-validation.json`；89 项测试及构建通过，原有包体积警告仍在。触屏与键盘均为浏览器模拟，未替代实体 iOS/Android 验收。
