# 山软今天吃什么

校园美食分享、推荐与个人分类收藏平台。正式前端位于 [`frontend/`](frontend/README.md)，移动端以最新 [`prototype/`](prototype/README.md) 的 51 张本地画板为视觉基准。

## 本地启动

```powershell
Set-Location frontend
npm ci
npm run dev
```

- 本地默认真实接口：<http://127.0.0.1:5173/>
- 正式接口模式：<http://127.0.0.1:5173/?demo=0>
- 隔离演示模式：<http://127.0.0.1:5173/?demo=1>
- PC 设计预览：<http://127.0.0.1:5173/?demo=1&view=desktop>
- 移动端对照：<http://127.0.0.1:5173/?demo=1&view=mobile>
- 全部设计画板：<http://127.0.0.1:5173/?demo=1#/design>
- APIv4 功能导航：<http://127.0.0.1:5173/?demo=1#/features>
- 独立后台演示：<http://127.0.0.1:5173/?demo=1&persona=admin#/admin>
- 未认证身份演示：<http://127.0.0.1:5173/?demo=1&persona=unverified#/favorites>

默认启动使用真实接口；按 [前端说明](frontend/README.md) 配置网关后进行联调。只有显式使用 `?demo=1` 才启用隔离演示。演示与正式会话、数据分开，接口失败不会回退演示数据。

## 构建与验收

自动部署到服务器的工作流、GitHub Secrets 和 Nginx 初始化步骤见 [前端服务器部署](docs/frontend-server-deployment.md)。

在 `frontend/` 中执行：

```powershell
npm test
pnpm build
npm run api:audit
```

`pnpm build` 自动清理旧 `frontend/dist/`、构建并压缩，输出为 `output/packages/YYYYMMDD-HHmmss.zip`（北京时间）。新包成功后删除该目录中同格式的旧 ZIP，仅保留最新一份；失败时保留上次的压缩包。`npm run build` 同样支持。

2026-11-10 验证：61 个测试文件、515 项测试通过，TypeScript 检查、权限规则检查和生产构建通过；201 项客户端接口封装通过 APIv7 覆盖核查。独立后台统一 16 个管理模块，管理员可从桌面页头或手机个人中心切换前后台，保留登录与两侧位置。五种宽度的后台验收及评论流程回归通过，详见 [独立后台与前后台切换](docs/独立后台与前后台切换-20261110.md) 和 [APIv7 接入与验收](docs/APIv7接入与验收-20261110.md)。真实账号与后端写入仍需测试环境联调。

源码、原型、接口契约和可复用验收脚本纳入 Git。`output/` 与 `frontend/output/` 存放本地报告、截图、浏览器缓存和发布包，`frontend/dist/` 存放默认构建产物；这些产物不提交。生成的 API 类型及移动端画板数据继续提交，保证常规安装与构建不依赖重新生成。

## 项目资料

| 文件                                                                                | 用途                                                 |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [PRD.md](PRD.md)                                                                    | 产品需求与验收基线                                   |
| [EatWhat 业务服务 APIv7.openapi.json](docs/EatWhat%20业务服务%20APIv7.openapi.json) | 当前接口契约，224 项操作，包含评论、回复、晒图及审核 |
| [APIv7 接入与验收](docs/APIv7接入与验收-20261110.md)                                | 手机、桌面、我的评论及后台审核接入与隔离验收         |
| [独立后台与前后台切换](docs/独立后台与前后台切换-20261110.md)                       | 统一管理导航、角色守卫、切换状态与响应式验收         |
| [APIv4 接入与验收](docs/APIv4接入与验收-20261102.md)                                | 新增 68 项接口、PC/手机功能与隔离验收                |
| [APIv3 接入与验收](docs/APIv3接入与验收-20261102.md)                                | 三字段授权查询、生成类型、Mock 及验证结果            |
| [前端接口问题清单](docs/前端接口问题清单-v2.md)                                     | 影响产品实现的后端问题                               |
| [前端开发与联调状态](docs/前端开发与联调状态.md)                                    | 已实现范围、验证结果和剩余依赖                       |
| [frontend/README.md](frontend/README.md)                                            | 启动、环境配置、工程结构、测试                       |
| [prototype/README.md](prototype/README.md)                                          | 当前移动端设计、规范和资源                           |
| [移动端还原说明](docs/移动端原型还原与实现.md)                                      | 页面映射、交互实现、待接入项和验收                   |
| [PC 端设计与实现](docs/PC端设计与实现.md)                                           | 同风格宽屏布局、预览和验证                           |

APIv7 用于当前开发，旧版契约保留作差异对照。`design/` 保留前一版方案，当前移动端以 `prototype/` 为准，正式代码在 `frontend/`。
