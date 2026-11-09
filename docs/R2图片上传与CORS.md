# 图片发布失败：R2 跨域配置

2026-11-08 检查 `eatwhat` 桶的上传预检：本地 `http://127.0.0.1:5173`、`http://localhost:5173` 和线上 `https://eat.v50to.you` 均返回 HTTP 403，错误为 `CORS not configured for this bucket`。

2026-11-09 再次以本地 `http://127.0.0.1:5173`、预期 `PUT` 和 `Content-Type` 向已配置桶发送只读 OPTIONS 预检，仍返回 403、`CORS not configured for this bucket`，没有 `Access-Control-Allow-Origin`。本地开发服务已启用固定桶上传代理；这项检查确认存储跨域问题仍存在，不等同于已抓取用户本次签名 PUT 的完整失败链路。此次未上传真实文件、未更改存储桶设置。上传及其他操作失败的前端反馈已统一为顶部 toast。

`presign` 返回 200 只表示业务服务签发了临时上传地址。浏览器接下来会向 R2 预检 `PUT` 和 `Content-Type`；预检未通过时，图片没有上传，也不能继续 `complete` 和发布菜品。重新点击发布或刷新登录不能补齐存储桶配置。

## R2 上需要应用的配置

Cloudflare Dashboard → R2 → `eatwhat` → Settings → CORS policy。在现有规则中合并 [上传规则](../frontend/config/r2-upload-cors.example.json)，保留已有图片读取等规则，再保存。该文件是 Dashboard 使用的数组格式；不要直接当成 Wrangler CLI 的配置格式。

规则仅允许已列出的前端来源使用 `PUT` 和 `Content-Type`，临时签名仍由 R2 验证。若新增前端域名，需要填写完整的协议、域名和端口，不含路径或末尾 `/`。`localhost` 与 `127.0.0.1`、5173 与 5174 都是不同来源。

参考 [Cloudflare R2 CORS 官方文档](https://developers.cloudflare.com/r2/buckets/cors/)。本次只准备配置，没有修改线上存储设置。

## 本地开发

`frontend/.env.local` 可配置 `UPLOAD_PROXY_TARGET=https://<R2账户ID>.r2.cloudflarestorage.com/eatwhat`，修改后重启 Vite。此值不是密钥，不要填写 Access Key、Secret Key 或完整预签名 URL。

开发页面把匹配该桶的上传请求交给同源 `/__storage_upload`；Vite 向固定 R2 地址转发原始图片及原始签名路径、参数和 Content-Type。代理仅接收带签名的 PUT，不转发应用 token、Cookie 或浏览器 Origin，不跟随重定向。其他地址仍使用原来的上传流程。

代理只在开发服务启用。生产包与 `vite preview` 仍直接访问 R2，必须应用上述 CORS 规则。不要使用 `no-cors`、关闭浏览器安全检查，或把应用登录令牌发给 R2。

## 验收

1. R2 的 OPTIONS 预检返回成功，包含匹配当前来源的 `Access-Control-Allow-Origin`、允许 `PUT` 的方法及 `Content-Type` 的请求头。
2. 使用新签发的地址上传，PUT 成功后才请求 `complete`，最后提交菜品。当前地址有效期由 `X-Amz-Expires` 给出，截图中的值为 300 秒，不能反复使用旧地址。
3. 检查单图与多图、网络失败后重试；失败时保留草稿与已经确认的图片，不能继续发布未上传的图片。
