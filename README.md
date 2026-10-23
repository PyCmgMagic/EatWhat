# 山软今天吃什么

校园美食分享、推荐与个人分类收藏平台。正式前端位于 [`frontend/`](frontend/README.md)，移动端以最新 [`prototype/`](prototype/README.md) 的 51 张本地画板为视觉基准。

## 本地启动

```powershell
Set-Location frontend
npm ci
npm run dev
```

- 本地默认 Mock（无需真实账号）：<http://127.0.0.1:5173/>
- 正式接口模式：<http://127.0.0.1:5173/?demo=0>
- 隔离演示模式：<http://127.0.0.1:5173/?demo=1>
- PC 设计预览：<http://127.0.0.1:5173/?demo=1&view=desktop>
- 移动端对照：<http://127.0.0.1:5173/?demo=1&view=mobile>
- 全部设计画板：<http://127.0.0.1:5173/?demo=1#/design>
- 管理员演示：<http://127.0.0.1:5173/?demo=1&persona=admin#/admin>
- 未认证身份演示：<http://127.0.0.1:5173/?demo=1&persona=unverified#/favorites>

默认启动不会自动连接文档中的远程服务；按 [前端说明](frontend/README.md) 配置网关后再进行真实联调。演示与正式会话、数据分开，演示操作不会写入后端。

## 项目资料

| 文件 | 用途 |
| --- | --- |
| [PRD.md](PRD.md) | 产品需求与验收基线 |
| [吃什么接口文档v2-openapi.yaml](docs/吃什么接口文档v2-openapi.yaml) | 当前唯一接口契约，版本 `auth-renewal-20261019` |
| [前端接口问题清单](docs/前端接口问题清单-v2.md) | 影响产品实现的后端问题 |
| [前端开发与联调状态](docs/前端开发与联调状态.md) | 已实现范围、验证结果和剩余依赖 |
| [frontend/README.md](frontend/README.md) | 启动、环境配置、工程结构、测试 |
| [prototype/README.md](prototype/README.md) | 当前移动端设计、规范和资源 |
| [移动端还原说明](docs/移动端原型还原与实现.md) | 页面映射、交互实现、待接入项和验收 |
| [PC 端设计与实现](docs/PC端设计与实现.md) | 同风格宽屏布局、预览和验证 |

旧 JSON 不用于当前开发。`design/` 保留前一版方案，当前移动端以 `prototype/` 为准，正式代码在 `frontend/`。
