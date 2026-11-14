# 前端服务器自动部署

目标为 `64.90.4.196`，使用 GitHub 托管的 `ubuntu-24.04` runner 和 Node.js 24。
默认 API 为 `https://eat.v50to.you/api`，默认前端公网地址为 `https://eat.v50to.you`。
若前端使用其他域名，修改下表变量并核对 API 的 CORS 允许来源。

## 发布流程

工作流为 `.github/workflows/deploy-frontend.yml`：

- PR：部署工具测试 → `frontend/npm ci` → `npm test` → `npm run build` → 打包。
- 合并 main 或在 main 手动运行：执行同样检查，将同一份已测试产物上传到服务器并发布。
- 仅 main 的非 PR 运行能进入 `production` 部署任务；不在 PR 中使用 SSH Secrets。
- SSH 严格验证已登记的主机公钥，不在工作流中动态信任 `ssh-keyscan` 的结果。
- 压缩包、逐文件 SHA-256、提交 SHA、运行编号和尝试编号一起校验；解包拒绝符号链接及目录穿越。
- 服务器只操作独立前端目录，不改后端、数据库、Nginx API 代理或原有源站校验。
- 原子切换 `current` 后检查公网 HTML、部署标记、JS 入口和只读 API。检查失败或可捕获中断会恢复上一版本链接。
- 为支持已打开页面继续加载旧资源，部署和回滚时仅保留 Vite 构建清单登记的带哈希资源，并记录跨版本保留的文件。手工初始化且缺少清单的 bootstrap 使用 HTML 引用的带哈希入口。普通 `public/assets/` 文件以目标版本为准，已经下架的文件不会被复制回来。
- GitHub 部署任务串行，服务器另有文件锁和构建编号围栏，拒绝较旧运行覆盖较新运行。

`VITE_ENABLE_DEMO=false` 固定用于生产构建。Vite 的 `API_PROXY_TARGET` 不参与生产静态托管。
前端调用的内层 `/api/location/...` 路径保持原样，不能再统一去掉一层 `/api`。

## GitHub 配置

在前端仓库创建 `production` Environment；按团队需要设置 main 分支限制及发布审批。
将以下值配置为该 Environment 的 Secrets，或仓库级 Actions Secrets；不要写入 Git 或聊天：

| Secret | 内容 |
| --- | --- |
| `FRONTEND_SSH_USER` | 专用非 root 账号，例如 `eatwhat-web` |
| `FRONTEND_SSH_PRIVATE_KEY` | 该账号部署专用的无口令 SSH 私钥，完整多行文本 |
| `FRONTEND_SSH_KNOWN_HOSTS` | 经独立核对指纹的主机公钥记录；非 22 端口使用 `[64.90.4.196]:端口` 格式 |

可选变量（不配置则使用默认值）：

| Actions Variable | 默认值 / 用途 | 配置位置 |
| --- | --- | --- |
| `FRONTEND_API_BASE_URL` | `https://eat.v50to.you/api`；同域也可用 `/api` | 仓库级 |
| `VITE_MEDIA_BASE_URL` | 空；按现有图片读取配置填写 | 仓库级 |
| `VITE_BAIDU_MAP_AK` | 空；需要地图时填写受域名限制的浏览器 AK | 仓库级 |
| `FRONTEND_SSH_PORT` | `22` | production 或仓库级 |
| `FRONTEND_DEPLOY_PATH` | `/www/wwwroot/eatwhat-frontend` | production 或仓库级 |
| `FRONTEND_PUBLIC_URL` | `https://eat.v50to.you`；仅网站根地址 | production 或仓库级 |
| `FRONTEND_API_SMOKE_URL` | `https://eat.v50to.you/api/recommend/tags`，返回 `code: 0` 及品类、口味和忌口数组 | production 或仓库级 |

构建变量必须在仓库级配置，因为构建任务不使用 production Environment。所有 `VITE_` 值会进入浏览器代码，只能放公开配置。

普通 GitHub runner 没有固定出口 IP。若服务器仅允许固定来源访问 SSH，应另行建立受控网络通道或改用专用部署 runner，不能仅因为 API 公网可访问就认为 SSH 已可用。

## 服务器一次性初始化

以下操作由服务器管理员按实际环境执行；本 PR 不会自动执行。先确认当前真正服务前端的 Nginx `server` 和静态目录。
当前后端仓库模板的静态目录是 `/www/wwwroot/eatwhat`，不能据此假定线上配置与模板完全相同。

1. 确认 `python3`、OpenSSH 和 Nginx 已安装。创建 `eatwhat-web` 非 root 账号及部署专用 SSH key；该账号不需要 sudo。
2. 核对已知良好的现有前端，保留原目录和一份独立备份，将其复制到 `releases/bootstrap`。不要覆盖或移动原目录。

```bash
# 以管理员身份执行，路径和账号应先核实。账号已存在则跳过 useradd。
useradd --system --create-home --shell /bin/bash eatwhat-web
install -d -m 0755 -o eatwhat-web -g eatwhat-web \
  /www/wwwroot/eatwhat-frontend \
  /www/wwwroot/eatwhat-frontend/releases \
  /www/wwwroot/eatwhat-frontend/releases/bootstrap
install -d -m 0700 -o eatwhat-web -g eatwhat-web /www/wwwroot/eatwhat-frontend/incoming
test -s /www/wwwroot/eatwhat/index.html
cp -a /www/wwwroot/eatwhat/. /www/wwwroot/eatwhat-frontend/releases/bootstrap/
chown -R eatwhat-web:eatwhat-web /www/wwwroot/eatwhat-frontend
sudo -u eatwhat-web ln -s releases/bootstrap /www/wwwroot/eatwhat-frontend/current
```

3. 给该账号安装部署公钥，权限为 `.ssh=0700`、`authorized_keys=0600`。建议在该 key 前加 `restrict`，禁用端口转发、agent 转发及 PTY。只授予前端目录权限。
4. 通过可信控制台核对服务器 SSH 主机公钥指纹，再把匹配的 known_hosts 记录配置到 GitHub Secret。不要把未经核对的扫描输出直接当作可信主机公钥。
5. 保留并备份 Nginx 配置，仅调整实际前端 `server` 中的静态根目录，保留原 `/api/` 转发、源站验证及受保护路径规则：

```nginx
root /www/wwwroot/eatwhat-frontend/current;
index index.html;

location = /index.html {
    add_header Cache-Control "no-store" always;
}
location = /deployment.json {
    add_header Cache-Control "no-store" always;
    try_files $uri =404;
}
location / {
    try_files $uri $uri/ /index.html;
}
```

现有 `location /` 应修改或复用，不要重复添加。检查 Nginx 用户对静态目录的读取/遍历权限，以及站点是否禁止跟随符号链接。
使用 `nginx -t` 验证后 reload，确认原首页仍正常；不要重新启动后端。
如果上层 CDN 缓存 HTML 或 `deployment.json`，先设置缓存绕过规则，避免旧版本缓存遮蔽校验和回滚。

没有旧前端时，先在 `bootstrap` 准备一个经核对的维护页面和 `assets/` JS 入口，再配置 Nginx；首次成功发布前它是回滚目标。

## 首次运行与回滚

配置完成后在前端仓库 Actions → **Frontend CI and server deployment** → **Run workflow**，选择 main。
成功后公网 `/deployment.json` 必须显示该次运行的提交 SHA 和 release，且首页及 JS 摘要一致。
仓库 Actions 工件保留 14 天；服务器保留所有版本、上传包及旧哈希资源，不自动删除原目录或备份。
请监测磁盘容量，在确认没有旧页面依赖并完成备份后人工清理。

在服务器上以部署账号进行手动回滚：

```bash
python3 /www/wwwroot/eatwhat-frontend/frontend_deploy.py rollback \
  --release '<已有版本目录名，或 bootstrap>' \
  --public-url https://eat.v50to.you
```

脚本仍会进行公网/API 校验；回滚失败时恢复回滚前的链接。手动回滚不会降低最高构建编号围栏。
发布进程被 SIGKILL 或服务器断电时无法运行异常处理，应核对 `current`、公网 marker 和 Actions 记录，必要时执行手动回滚。
这套检查不替代真人账号登录、学校 SSO 或上传流程的端到端验收。
