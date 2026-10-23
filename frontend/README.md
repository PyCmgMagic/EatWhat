# 山软今天吃什么 · 前端

React 19、TypeScript、Vite、React Router、TanStack Query。当前移动端以 `../prototype/` 的本地画板为设计来源；旧 `design/` 不再作为移动端基准。51 张 HTML 画板编译为 React 页面，复用原始 CSS、SVG 插画、MingCute 图标、九种舞台色，以及本地托管的 Noto Sans SC 和 Bricolage Grotesque 字体。

已新增同风格 PC 布局：顶部导航、横向圆桌舞台、多列内容、地图与店铺双栏、个人侧栏、详情和发布分栏。默认在 1024px 及以上自动使用桌面布局。详见 [PC 设计说明](../docs/PC端设计与实现.md)。

## 启动

```powershell
Set-Location D:\项目\EatWhat\frontend
npm ci
npm run dev
```

- 本地开发默认 Mock（自动进入模拟账号）：<http://127.0.0.1:5173/>
- 显式 Mock：<http://127.0.0.1:5173/?demo=1>
- PC 设计预览：<http://127.0.0.1:5173/?demo=1&view=desktop>
- 移动端对照：<http://127.0.0.1:5173/?demo=1&view=mobile>
- 全部画板：<http://127.0.0.1:5173/?demo=1#/design>
- 原始样例对照：`/?demo=1#/reference/G2-Home`
- 真实接口模式：<http://127.0.0.1:5173/?demo=0>
- 管理演示：`/?demo=1&persona=admin#/admin`
- 未认证演示：`/?demo=1&persona=unverified#/favorites`

本地开发默认使用独立 Mock 数据，不需要后端或真实账号。首次打开自动登录模拟学生账号；主动退出后，登录页可点击「一键 Mock 登录」，刷新也会保留退出状态。收藏、标签、发布和资料修改保存在本机，不发送真实邮件、短信或业务写请求。桌面右侧提供身份切换，手机宽度保留原有画板。`?demo=0` 显式切回真实接口，接口失败不会回退样例内容。生产默认关闭演示，独立演示构建需设置 `VITE_ENABLE_DEMO=true` 并使用 `?demo=1`。

```powershell
npm run prototype:generate  # prototype 更新后重新生成，需 Python 3 标准库
npm run api:generate        # 从 ../docs/吃什么接口文档v2-openapi.yaml 生成类型
npm run typecheck
npm test
npm run build
npm run preview             # 生产产物，5174
```

生成内容在 `src/mobile/generated/`，资源在 `public/prototype/assets/`，业务适配在 `src/mobile/bridge.tsx`，不要直接修改生成文件。画板结构调整后需检查适配层中的节点编号。前端运行和生产构建不依赖 Python 或 Claude Design 服务。

## 配置后端

复制 `.env.example` 为 `.env.local`，配置可用测试环境后重启服务。唯一契约为 `../docs/吃什么接口文档v2-openapi.yaml`。

| 变量 | 含义 |
| --- | --- |
| `VITE_API_BASE_URL` | API 前缀，默认 `/api` |
| `API_PROXY_TARGET` | 开发网关 Origin，不含路径；默认未连接远程后端 |
| `VITE_MEDIA_BASE_URL` | 图片 key 永久读取前缀，不能用上传签名地址代替 |
| `VITE_CONSENT_POLICY_URL` | 当前政策全文地址，缺失时阻止临时凭证授权 |
| `VITE_SDU_AUTH_URL` | 能保持当前身份的学校认证入口，不在 URL 附带 token |
| `VITE_ENABLE_DEMO` | 生产演示包开关 |

Hash 路由支持刷新详情。开发代理仅在 dev 生效，生产需配置 API 网关和存储 CORS。控制器 `/api/location/...` 经默认网关请求为 `/api/api/location/...`，不得去重。

保留原有 API 约定：动态 tokenName 请求头、Bearer tokenValue；非零业务码失败；401 清会话，403 保留会话；临时授权凭证不当作登录；presign → 原始 PUT → complete → 保存 key，存储 PUT 不带应用 token。创建返回 Void，成功后去列表查找，不猜新 ID；结果不确定时阻止当前表单重复创建。

## 当前功能

- 三栏悬浮导航和发布入口、拖动转盘、换一道、舞台色过渡、推荐组分类。
- 菜品和餐厅详情、店内菜品、点赞收藏、公共与个人标签、分类改名删除、当前页收藏筛选。
- 选店、文件选择、圆形取景、拖动缩放、JPEG 裁剪、九色取色建议、零元价格发布；当前会话内保留草稿，成功后清空。
- 密码登录、用户名注册、邮箱认证入口、资料和头像、补充资料、改密、手机绑定、关注粉丝、历史、隐私、消息。
- 保留管理员维护页面。仅服务端 admin 角色可用，菜品读取仍需 verified。

评论、举报、反馈、设备、屏蔽、注销、手机号注册和匿名找回密码等缺少完整接口的功能保留设计并标注待接入，操作不伪造成功。地图是 SVG 示意图，餐厅列表使用搜索接口。舞台色保存在本机，云端色值字段待补充。

详见 [还原说明](../docs/移动端原型还原与实现.md)。尚未使用真实后端账号完成端到端联调。

## 浏览器验收

启动开发服务后，在仓库根目录执行，使用独立 Playwright CLI 浏览器：

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

PC 标签切换专项使用 `scripts/desktop-tabs.js`，覆盖主导航、首页分类、上传/收藏、快速切换、键盘、减少动态效果和响应式指示器对齐。内容过渡由 `src/desktop/motion.tsx` 管理。

PC 编辑资料改为左侧头像与实时预览、右侧双列表单，昵称、签名、性别、生日和省市同页保存。`/me/details` 同样进入完整编辑页；头像先裁剪和预览，保存时再上传，失败会保留修改并复用已上传 key。专项使用 `scripts/desktop-profile.js`、`scripts/desktop-profile-api.js`，覆盖宽度、移动端回归及拦截接口故障，截图为 `../output/playwright/pc-profile-*.png`。单元/契约测试共 9 个文件、37 项通过。

菜品上传照片采用与默认插画一致的圆盘布局和浅色舞台背景，列表中不再铺满卡片；图片来源参与插画识别，重名上传图不会被误判。专项使用 `scripts/desktop-food-photos.js`，覆盖四种桌面宽度、推荐与详情、移动端，完成后恢复脚本使用的演示数据。

PC 评论整合到 `/foods/:id` 的页内讨论区，右侧保留当前菜品和编辑框。Mock 支持本地图文评论、回复、点赞、排序、刷新恢复与我的评论索引；旧评论入口进入相应菜品，真实模式禁用提交，不调用缺少的评论接口。运行 `scripts/desktop-discussion.js`、`scripts/desktop-discussion-api.js` 验证，演示评论单独存放在 `eatwhat-demo-comments-v1`，验收结束会恢复原记录。移动端原型流程保持不变。

PC `/me/tags`、`/history` 使用个人中心侧栏，分别为双列标签管理卡片和按日期分组的双列足迹。标签支持就地重命名、删除确认与失败重试；足迹支持菜品/店铺切换、分页、本页筛选与失效记录保护。标签创建仍从菜品详情开始，收藏标签只筛选当前页，足迹清空暂无接口。运行 `scripts/desktop-library.js`、`scripts/desktop-library-api.js` 验证，截图在 `../output/playwright/pc-library-*.png`。Mock 店铺足迹仅记录直接进入店铺页的访问，旧菜品记录保持兼容。

PC 二级页面已补齐专门布局，覆盖设置与认证、通知、食友主页、关注列表、新建店铺、登录注册和说明页。新建店铺及补充位置合并同页填写，提交返回 Void 后回到选店；失败保留输入，结果未知时跨页面暂停重复创建。12 个待接入入口有明确的开放状态与可用跳转。`scripts/desktop-secondary.js` 检查 28 个入口 × 四种桌面宽度、缩放预览及移动端回归；`scripts/desktop-secondary-api.js` 拦截 36 次请求验证操作、防重和失败恢复，无远程请求。截图为 `../output/playwright/pc-secondary-*.png`，完整清单见 [PC 适配审计](../docs/PC端适配审计.md)。
