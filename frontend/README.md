# 山软今天吃什么 · 前端

React 19、TypeScript、Vite、React Router、TanStack Query。当前移动端以 `../prototype/` 的本地画板为设计来源；旧 `design/` 不再作为移动端基准。51 张 HTML 画板编译为 React 页面，复用原始 CSS、SVG 插画、MingCute 图标、九种舞台色，以及本地托管的 Noto Sans SC 和 Bricolage Grotesque 字体。

已新增同风格 PC 布局：顶部导航、横向圆桌舞台、多列内容、地图与店铺双栏、个人侧栏、详情和发布分栏。当前在 600px 及以上使用可重排的桌面/平板布局，手机使用移动端布局。详见 [PC 设计说明](../docs/PC端设计与实现.md)。

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
npm run api:generate        # 从 ../docs/EatWhat 业务服务 APIv5.yaml 生成类型
npm run typecheck
npm test
npm run build
npm run preview             # 生产产物，5174
```

生成内容在 `src/mobile/generated/`，资源在 `public/prototype/assets/`，业务适配在 `src/mobile/bridge.tsx`，不要直接修改生成文件。画板结构调整后需检查适配层中的节点编号。前端运行和生产构建不依赖 Python 或 Claude Design 服务。

## 当前交付验证（2026-11-06）

- 34 个测试文件、241 项单元与契约测试通过，TypeScript 检查和生产构建通过。
- APIv5 共 204 项 HTTP 操作，185 项客户端操作已有封装；另有 5 项后端回调及 14 项明确排除的活动接口。
- 生产依赖通过 npm 官方源审计，未报告已知漏洞。桌面与手机生产页面已检查，显式传入 `demo=1` 仍保持真实模式，政策正文可以读取。
- 发布包从独立输出目录构建，校验所需文件、归档内容及 SHA-256。实际部署配置及真实账号完整业务流程不在本次打包验证范围内。

`../output/`、`output/` 和 `dist/` 为本地产物目录，不纳入 Git；下文引用的报告、截图及日志是运行验收脚本后生成的本地记录。`scripts/` 中的可复用验收脚本及 `src/` 中的测试继续纳入版本管理。后续各日期段落保留当时的测试数量与边界，以本节为本次交付结果。

## 配置后端

复制 `.env.example` 为 `.env.local`，配置可用测试环境后重启服务。现行契约为 `../docs/EatWhat 业务服务 APIv5.yaml`，文档版本 `source-contract-20261101`；旧版契约保留作历史差异对照。185 项客户端操作已有封装，APIv4 新增的 68 项对应页面已接入。APIv5 已移除发布请求中的 `removeBackground` 和管理配置中的 `autoCutout`，生成类型和演示数据同步更新。功能导航为 `/?demo=1#/features`，管理页面为 `/?demo=1&persona=admin#/admin/v4`。接入及部署边界见 [APIv4 接入与验收](../docs/APIv4接入与验收-20261102.md)。

当前本机已配置 `API_PROXY_TARGET=https://eat.v50to.you/api`，浏览器请求同源 `/api`。例如 `/api/foods/list` 转发为 `https://eat.v50to.you/api/foods/list`，内层控制器前缀继续保留。新域名的连通性记录见 [后端地址与连通性](../docs/后端地址与连通性-20261023.md)。直接跨域部署时需检查 CORS，详见 [APIv2 接入与验收](../docs/APIv2接入与验收-20261026.md)。

| 变量                  | 含义                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `VITE_API_BASE_URL`   | API 前缀，默认 `/api`                                                |
| `API_PROXY_TARGET`    | Vite 开发/预览代理，支持完整网关路径，当前为 `https://eat.v50to.you/api` |
| `VITE_MEDIA_BASE_URL` | 图片 key 永久读取前缀，不能用上传签名地址代替                        |
| 学校认证地址          | 由 POST `/auth/sdu` 返回，无需固定入口配置，不拼入应用 token         |
| `VITE_ENABLE_DEMO`    | 生产演示包开关                                                       |
| `VITE_BAIDU_MAP_AK`   | 百度地图 JavaScript API 浏览器端 AK，存放在 `.env.local` |

Hash 路由支持刷新详情。开发和 Vite preview 均使用同源代理；生产静态托管仍需配置同源 API 反向代理及存储 CORS。控制器 `/api/location/...` 的内层前缀必须保留。

保留原有 API 约定：动态 tokenName 请求头、Bearer tokenValue；非零业务码失败；401 清会话，403 保留会话；临时授权凭证不当作登录；presign → 原始 PUT → complete → 保存 key，存储 PUT 不带应用 token。当前创建返回 `{ id, moderationStatus, revisionId }`；有 revisionId 时进入私有提交进度，无私有修订时使用准确 ID 继续详情或发布。成功响应缺少有效 ID 时按结果不确定处理，暂停重复创建。

## 登录注册政策

密码登录、用户名注册和手机验证码登录/注册均需主动勾选当前政策；支持后端正文弹窗、版本变化后重新确认和 proof 待授权恢复。默认读取政策接口的 version/url，正文地址按站点绝对路径或 HTTPS URL 解析；正文加载失败时不能提交同意。Mock 同样提供明确标注的演示政策。详见 [政策同意接入](../docs/登录注册政策同意接入-20261023.md)。

历史 APIv2 迁移覆盖 117 项客户端操作，另有 5 项后端回调、14 项按约定排除的活动操作。已新增首次设置登录名、TA 的分享、足迹清空、个性化推荐、屏蔽管理、密码冲突恢复、政策配置及账号安全复核。该阶段的资料裁决保护已在 APIv4 升级时替换为 expectedRevision/selectedHeadId 裁决。详见 [APIv2 接入与验收](../docs/APIv2接入与验收-20261026.md)。

验证码发送统一接入腾讯国际站 CAPTCHA，原六类发送方法及新增手机号换绑发送在每次操作时读取新的 no-store 配置；SDK 按需加载，不进入首页请求。取消、失败、过期或路由卸载均丢弃本次票据；业务成功后才启动倒计时。Mock 使用独立模拟弹层，点击“完成验证”后短信码为 `123456`；恢复邮件的演示令牌为 `demo-recovery-token`，不会发送真实短信或邮件。

```powershell
npm run api:audit           # 全量接口分类及源码消费位置
npm run api:diff            # APIv4 → APIv5 接口与模型差异
```

APIv2 历史回归脚本为 `scripts/api-v2-flows.js`、`api-v2-mobile-flows.js`、`api-v2-admin-responsive.js`、`api-v2-live-contract.js`、`api-v2-production.js`，均隔离真实写入。生产检查需先执行 `npm run build` 与 `npm run preview`。历史 `latest-api-*` 和 APIv2 记录继续保留，当前契约为 APIv5，覆盖及差异报告分别为 `../output/api-v5-coverage-20261104.json` 和 `../output/api-v5-diff-20261104.json`。

APIv3 的授权状态查询仅返回 `status`、`identityReady`、`policyVersion`，授权面板分别展示授权政策版本与当前政策版本；授权、撤回及登录过程仍保留原进度模型。Mock 查询同样只返回三字段，兼容旧本地记录并保留上传。APIv4 的登录响应 `loginId` 按当前契约支持字符串或数值。APIv3 历史覆盖记录为 `../output/api-coverage-20261102.json`，差异记录为 `../output/api-v3-diff-20261102.json`，浏览器专项为 `scripts/api-v3-consent.js`。

类型生成统一使用 `npm run api:generate`，读取 APIv5 YAML，并兼容历史 `$ref` 的 nullable 标记。

## 当前功能

- 三栏悬浮导航、转盘与舞台过渡；校区/饭点/分类推荐、换一批、游客 deviceId 与手动口味偏好。
- 全站菜品搜索、分类/预算/区域/排序；无需定位的店铺浏览；服务端完整收藏分类筛选。
- 菜品和餐厅详情、点赞收藏、公共与个人标签、分类改名删除；已认证作者可编辑和删除自己的菜品。
- 选店、圆形取景和缩放、JPEG 裁剪、九色建议、零元价格；初始标签、舞台色、候选色、饭点和裁剪信息随创建保存。草稿在当前会话内跨页保留，成功后清空。
- 密码与手机验证码登录、手机自动注册、用户名注册、邮箱及学校认证、资料头像、补充资料、密码首次设置/修改、手机绑定、关注粉丝、历史、隐私、消息。
- 保留管理员维护页面。管理操作遵守服务端 admin 与对应认证要求；游客可浏览公开内容，收藏要求登录，写入标签/点赞/发布仍要求学生认证。

举报、反馈、设备、换绑、注销、通知偏好和专题已按现行协议接入，真实可用性依赖后端部署及账号联调。评论 CRUD 仍待后端提供接口。常规找回密码支持先手机登录再设置密码；密码冲突恢复另有邮件申请与令牌重置入口。地图已接入百度地图官方 JSAPI 4.0，支持拖动缩放、设备定位、按后端坐标展示店铺及新店选点；缺失坐标的店铺只保留在列表中。手机裁剪页已移除自动去背景入口，普通照片按圆盘样式展示。舞台色读取优先使用云端字段，兼容旧本地记录。地图配置、坐标处理与验收见 [真实地图接入](../docs/真实地图接入-20261030.md)。

详见 [还原说明](../docs/移动端原型还原与实现.md)。尚未使用真实后端账号完成端到端联调。

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

PC 编辑资料改为左侧头像与实时预览、右侧双列表单，昵称、签名、性别、生日和省市同页保存。`/me/details` 同样进入完整编辑页；头像先裁剪和预览，保存时再上传，失败会保留修改并复用已上传 key。历史专项为 `scripts/desktop-profile.js`、`scripts/desktop-profile-api.js`，截图为 `../output/playwright/pc-profile-*.png`。新版未约定性别、生日与省市的清空写法，因此当前会提示保留或填写有效值，不提交未经约定的 null。

菜品上传照片采用与默认插画一致的圆盘布局和浅色舞台背景，列表中不再铺满卡片；图片来源参与插画识别，重名上传图不会被误判。专项使用 `scripts/desktop-food-photos.js`，覆盖四种桌面宽度、推荐与详情、移动端，完成后恢复脚本使用的演示数据。

PC 评论整合到 `/foods/:id` 的页内讨论区，右侧保留当前菜品和编辑框。Mock 支持本地图文评论、回复、点赞、排序、刷新恢复与我的评论索引；旧评论入口进入相应菜品，真实模式禁用提交，不调用缺少的评论接口。运行 `scripts/desktop-discussion.js`、`scripts/desktop-discussion-api.js` 验证，演示评论单独存放在 `eatwhat-demo-comments-v1`，验收结束会恢复原记录。移动端原型流程保持不变。

PC `/me/tags`、`/history` 使用个人中心侧栏，分别为双列标签管理卡片和按日期分组的双列足迹。标签支持就地重命名、删除确认与失败重试；足迹支持菜品/店铺切换、分页、本页筛选与失效记录保护。标签从菜品详情或发布初始标签创建，收藏标签现已查询全部收藏，足迹清空暂无接口。历史布局验收为 `scripts/desktop-library.js`、`scripts/desktop-library-api.js`，截图在 `../output/playwright/pc-library-*.png`。Mock 店铺足迹仅记录直接进入店铺页的访问，旧菜品足迹继续兼容。

PC 二级页面已补齐专门布局，覆盖设置与认证、通知、食友主页、关注列表、新建店铺、登录注册和说明页。新建店铺及补充位置合并同页填写，提交返回 Void 后回到选店；失败保留输入，结果未知时跨页面暂停重复创建。12 个待接入入口有明确的开放状态与可用跳转。历史 `scripts/desktop-secondary.js` 检查 28 个入口 × 四种桌面宽度及移动端回归；其中整体缩放预览已由下述响应式布局替代。`scripts/desktop-secondary-api.js` 拦截 36 次请求验证操作、防重和失败恢复，无远程请求。截图为 `../output/playwright/pc-secondary-*.png`，完整清单见 [PC 适配审计](../docs/PC端适配审计.md)。

关注与粉丝现已整合到个人主页：PC 使用双列食友弹层，手机使用单列底部面板，点击数量就地打开，关闭后保留原来的主页内容。自己的入口为 `/me?people=fans` 或 `/me?people=follow`，他人的入口为 `/users/:id?people=...`；旧 `/follows?tab=...&userId=...` 自动转到对应主页。分页、本页搜索、隐私保护、失败重试和浏览器前进后退均保留，点击食友后返回可恢复列表。移动端他人主页的菜单默认收起，设计对照模式保持原样。当前专项为 `scripts/desktop-profile-people.js` 和 `scripts/desktop-profile-people-touch.js`；旧二级页脚本中独立关注页面的断言已过时。记录为 `../output/profile-people-validation.json`，截图为 `../output/playwright/profile-people-desktop.png`、`profile-people-mobile.png`。触屏为浏览器模拟。

响应式布局现由 `src/responsive.css` 统一处理。自动模式下，小于 600px 使用移动界面，手机画板在 320–520px 范围贴合可用宽度；600–767px 使用紧凑平板布局，768px、1024px 与 1200px 继续调整侧栏、网格和表单。显式 `view=desktop` 在窄屏重新排版，已移除固定 1280px 后整体缩小的做法；`view=mobile` 和原型对照入口继续可用。压缩搜索框后保留搜索图标入口。关注、裁剪、地点与饭点、提示面板支持窄屏与矮屏；裁剪预览尺寸变化沿用同一套取景坐标。编辑流程沿用进入时的界面控制器，避免窗口缩放或旋转清空输入，离开流程后恢复自动断点。

`scripts/desktop-responsive.js` 检查 201 个页面与视口组合（11 种主要宽度、13 个主要 PC 页面、自动切换及横屏弹层）；`scripts/desktop-responsive-interactions.js` 通过 8 组跨断点操作，`scripts/desktop-tabs.js` 的 7 组回归通过。无横向溢出、页头重叠、页面异常或真实 API 请求。记录见 `../output/responsive-validation.json`，截图为 `../output/playwright/responsive-*.png`。验收使用独立 Chrome 和触屏模拟，实体手机和其他浏览器仍需最终验收。

2026-10-24 手机与平板补查：`scripts/desktop-mobile-tablet-audit.js` 覆盖 44 个页面 × 9 种尺寸（396 组，包含短屏和横屏）；`scripts/desktop-mobile-tablet-flows.js` 通过 6 组专项，覆盖选店列表末项、评论滚动、地图全部标记、600px 断点、16 组长文本及模拟键盘避让。修复选店遮挡与选中对比度、食友装饰图溢出、地图选中卡片遮挡、手机表单宽度、完整菜名与长地址展示。`src/app/viewport.ts` 根据可视视口调整食友、标签和政策弹层。报告见 `../output/mobile-tablet-validation.json`；89 项测试及构建通过，原有包体积警告仍在。触屏与键盘均为浏览器模拟，未替代实体 iOS/Android 验收。
