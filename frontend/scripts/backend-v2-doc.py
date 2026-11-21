"""Generate the backend v2 API markdown doc from the OpenAPI contract plus
frontend usage.

Usage: python3 frontend/scripts/backend-v2-doc.py <repo-root> <out.md> [backend-root]
backend-root (the EatWhat Spring Boot checkout) is used for the business-code table.
"""
import datetime, glob, json, re, subprocess, sys
from collections import OrderedDict

root, out = sys.argv[1], sys.argv[2]
spec = json.load(open(f"{root}/docs/EatWhat 业务服务 后端v2.openapi.json"))
S = spec["components"]["schemas"]
ep_src = open(f"{root}/frontend/src/api/backend-v2-endpoints.ts").read()
endpoints = {
    (m, p): (n, a)
    for n, m, p, a in re.findall(
        r'"(\w+)": \{\s*"method": "(\w+)",\s*"path": "([^"]+)",\s*"access": "(\w+)"', ep_src
    )
}
code = "".join(
    open(f).read()
    for f in glob.glob(f"{root}/frontend/src/v2/*.ts*")
    if not f.endswith("demo.ts")
)
code += open(f"{root}/frontend/src/api/backend-v2.ts").read()

# Fields the generator in scripts/backend-v2.mjs repairs because springdoc
# merges same-named Java records. Show the repaired shapes here.
REPAIRED = {
    ("GET", "/admin/ai/settings"): (None, "{configured, enabled, baseUrl?, apiKeyHint?, model?, responseFormat?, updatedBy?, updatedAt?}"),
    ("PUT", "/admin/ai/settings"): ("{enabled, baseUrl, apiKey, model, responseFormat}", "同 GET"),
    ("GET", "/notification/cards"): (None, "PageResult<{id, column, kind, target{domain,id}, day, memberCount, unreadMemberCount, latestAt, actors[{id,displayName,avatar?}], data}>"),
    ("GET", "/foods/detail/{id}"): (None, "Food{id, restaurantId, restaurantName, accountId?, name, category, price?, description?, pictureUrls[], tags[], signature, likeCount, favoriteCount, isLiked?, isFavorite?, createdAt, updatedAt}"),
    ("PUT", "/foods/edit/{id}"): ("{name, category, price?, description, pictures[], tags[], signature}", None),
    ("GET", "/foods/options"): (None, "{categories[], tags[], maxPictures, maxTags, maxSignatures}"),
    ("GET", "/push/settings"): (None, "{categories: {COMMENTS|LIKES_AND_FAVORITES|FOLLOWS|SYSTEM: boolean}}"),
}

NOTES = {
    "POST /feedback/messages": "text 必填 ≤500 字；screenshotKeys ≤3（biz=feedback 上传 key）；context 可选 {type: FOOD|RESTAURANT, id}",
    "POST /feedback/catalog-errors": "errorType：WRONG_NAME 名称有误、WRONG_LOCATION 位置有误、CLOSED 已关店、DUPLICATE 重复、OTHER；note ≤200 字",
    "POST /feedback/reports": "targetType：FOOD、RESTAURANT、COMMENT、USER；reason：NOT_REAL_PHOTO（仅菜/评论）、ADVERTISING、ILLEGAL_OR_UNFRIENDLY、OTHER；note ≤200 字；不能举报自己",
    "GET /feedback/mine": "kind 可筛选 FEEDBACK、CATALOG_ERROR、REPORT；duplicate=true 时返回已有的未处理记录",
    "GET /feedback/mine/{id}": "只能看自己的，别人的返回 10001",
    "GET /admin/feedback/cases": "status 默认 OPEN（旧→新），CLOSED 按处理时间新→旧；kind 同上",
    "POST /admin/feedback/cases/{id}/resolution": "outcome：ACCEPTED、REJECTED、RESOLVED（仅意见反馈）；reply ≤200 字（提交人可见）；internalNote ≤500 字；已处理再提交返回 40002；catalogChangeRequired=true 时需人工去改店铺",
    "PUT /admin/remote-config/settings": "整体替换；flags 只能是 publish、newShop、comment、push、topic；params 只能是 mealWindows、batchSize(1–50)、shopRateMinVotes(1–100)、backgroundPollIntervalMinutes(1–1440)、backgroundPollDurationMinutes(1–1440)、distanceHideKm(1–100)、categoryOrder(≤20)；maintenance.mode：NONE、READ_ONLY、DOWN；expectedRevision 冲突返回 20006",
    "PUT /admin/remote-config/versions/{platform}": "platform：android、ios、web；storeUrl 只接受 https、market、itms-apps；minBuild ≤ latestBuild；需 expectedRevision",
    "POST /admin/remote-config/announcements": "level：NORMAL、IMPORTANT；content 必填 ≤1000 字；linkUrl 只接受 https 或站内绝对路径；platforms/campusIds 为空表示不限；notifyUsers 仅新建有效，且不能同时限定平台/校区/构建号",
    "PUT /admin/remote-config/announcements/{id}": "同新建，必须带 expectedRevision",
    "DELETE /admin/remote-config/announcements/{id}": "query 必须带 expectedRevision",
    "GET /admin/remote-config/audit": "target：SETTINGS、VERSION_LINE、ANNOUNCEMENT；action：CREATE、UPDATE、DELETE",
    "GET /remote-config": "flags 缺省为开；announcements 最多 20 条；update 只在同时给出 platform 与 build 时返回（decision：FORCE、SUGGEST、NONE）",
    "PUT /admin/ai/settings": "API Key 只写不读，留空表示不修改；baseUrl 为 OpenAI 兼容端点",
    "POST /admin/ai/settings/test": "imageUrl 可选，会真实调用一次提供商",
    "POST /foods/{foodId}/comments": "text ≤200 字，pictureKeys ≤3（biz=comments），两者至少一样",
    "POST /foods/{foodId}/comments/{commentId}/replies": "回复只能是文字；replyToId 可选，为根评论或其下某条回复，用于标出被回复的人",
    "GET /foods/{foodId}/comments": "sort：NEWEST（默认）、HOT",
    "DELETE /comments/{commentId}": "作者本人或管理员；删除根评论时回复一起删除",
    "POST /push/bindings": "platform：android、ios、web；deviceToken ≤4096 字符（需推送服务商令牌）",
    "POST /push/settings/enable": "category：COMMENTS、LIKES_AND_FAVORITES、FOLLOWS、SYSTEM",
    "POST /push/settings/disable": "同上",
    "GET /admin/engagement/stats": "date 可选（yyyy-MM-dd，默认今天，按 Asia/Shanghai）",
    "POST /auth/register": "后端已关闭用户名注册，返回 30014，请使用手机号验证码注册",
    "POST /auth/login": "同一登录名失败过多返回 30015，完成人机验证后带 X-Captcha-Ticket / X-Captcha-Randstr 重试",
    "POST /upload/presign": "拿到 putUrl 与 key → PUT putUrl（Content-Type 与字节数需一致）→ POST /upload/complete {key}",
}

ACCESS = {"public": "公开", "login": "登录", "verified": "认证", "verifiedOrAdmin": "认证或管理员", "admin": "管理员"}


def show(s, depth=0, seen=()):
    if not s:
        return "any"
    if "$ref" in s:
        n = s["$ref"].split("/")[-1]
        if n in seen or depth > 2:
            return n
        return show(S[n], depth + 1, seen + (n,))
    if "anyOf" in s or "oneOf" in s:
        parts = [show(x, depth, seen) for x in s.get("anyOf", s.get("oneOf")) if x.get("type") != "null"]
        return "|".join(parts) + ("?" if len(parts) < len(s.get("anyOf", s.get("oneOf", []))) else "")
    t = s.get("type")
    if t == "array":
        return show(s.get("items"), depth, seen) + "[]"
    if t == "object" or "properties" in s:
        if "properties" not in s:
            return "map<string," + show(s.get("additionalProperties"), depth, seen) + ">"
        return "{" + ", ".join(k + ": " + show(v, depth, seen) for k, v in s["properties"].items()) + "}"
    if "enum" in s:
        return "/".join(map(str, s["enum"]))
    fmt = s.get("format")
    return {"integer": "int", "number": "number", "string": "string", "boolean": "bool"}.get(t, t or "any") + (
        "(date-time)" if fmt == "date-time" else ""
    )


def data_shape(op):
    r = op["responses"].get("200", {})
    if "content" not in r:
        return "302 跳转"
    sc = list(r["content"].values())[0]["schema"]
    n = sc.get("$ref", "").split("/")[-1]
    dd = S.get(n, {}).get("properties", {}).get("data")
    if dd is None:
        return show(sc)
    s = show(dd)
    m = re.match(r"\{currentPage: int, items: (.*)\[\], totalPages: int, totalItems: int, hasNext: bool\}$", s)
    return f"PageResult<{m.group(1)}>" if m else s


groups = OrderedDict()
for path, methods in spec["paths"].items():
    for m, op in methods.items():
        if m not in ("get", "post", "put", "delete", "patch"):
            continue
        groups.setdefault(op.get("tags", ["其他"])[0], []).append((m.upper(), path, op))

lines = []
w = lines.append
total = used = 0
rows_unused = []
for tag in sorted(groups):
    w(f"\n### {tag}\n")
    w("| 方法 | 路径 | 说明 | 权限 | 前端操作名 | 前端已接入 |")
    w("| --- | --- | --- | --- | --- | --- |")
    details = []
    for m, path, op in groups[tag]:
        name, access = endpoints.get((m, path), ("—", None))
        summary = re.sub(r"^【[^】]*】", "", op.get("summary", "")).strip()
        if access:
            total += 1
            hit = bool(re.search(r'["\']%s["\']' % name, code)) or (
                "{" not in path and f'"{path}"' in code
            )
            used += hit
            if not hit:
                rows_unused.append((m, path, summary))
        else:
            hit = None
        flag = "—" if hit is None else ("✅" if hit else "⬜")
        exempt = "（同意前可用）" if "同意前可用" in op.get("summary", "") else ""
        w(f"| {m} | `{path}` | {summary}{exempt} | {ACCESS.get(access, '浏览器回跳')} | `{name}` | {flag} |")
        key = f"{m} {path}"
        params = [f"{p['in']}.{p['name']}{'' if p.get('required') else '?'}: {show(p.get('schema'))}" for p in op.get("parameters", [])]
        body = None
        if op.get("requestBody"):
            body = show(list(op["requestBody"]["content"].values())[0]["schema"])
        data = data_shape(op)
        rb, rd = REPAIRED.get((m, path), (None, None))
        body = rb or body
        data = rd or data
        d = [f"- **{m} `{path}`**"]
        if params:
            d.append("  - 参数：" + "；".join(f"`{x}`" for x in params))
        if body:
            d.append(f"  - 请求体：`{body}`")
        d.append(f"  - data：`{data}`")
        if key in NOTES:
            d.append("  - 约束：" + NOTES[key])
        details.append("\n".join(d))
    w("\n<details><summary>字段明细</summary>\n")
    w("\n".join(details))
    w("\n</details>")

codes = []
if len(sys.argv) > 3:
    codes_src = open(f"{sys.argv[3]}/src/main/java/you/v50to/eatwhat/common/BizCode.java").read()
    codes = re.findall(r"^\s+([A-Z_]+)\((\d+), \"([^\"]*)\"\)", codes_src, re.M)

backend_head = "未知"
if len(sys.argv) > 3:
    backend_head = subprocess.run(
        ["git", "-C", sys.argv[3], "rev-parse", "--short", "HEAD"],
        capture_output=True, text=True,
    ).stdout.strip() or "未知"
today = datetime.date.today().isoformat()

head = f"""# EatWhat 后端 v2 接口文档

> 生成日期：{today}。来源：后端仓库 `EatWhat` HEAD `{backend_head}`（`docs/openapi.json` 由 `OpenApiDocIT` 从代码生成，与本仓库
> `docs/EatWhat 业务服务 后端v2.openapi.json` 一致），枚举与校验规则取自后端 DTO / Service 源码。
> 前端接入情况按 `frontend/src/v2` 与 `frontend/src/api/backend-v2.ts` 中的实际调用统计（不含演示数据）。

## 通用约定

- **网关**：应用挂在根路径，公网经 nginx `location /api/` 剥前缀转发，前端请求统一加 `/api`。
- **响应**：HTTP 200 + `Result{{code, data, msg, timestamp}}`，`code=0` 为成功，按 `code` 分支，`msg` 只用于展示。
- **登录态**：请求头 `satoken: Bearer <tokenValue>`；登录、注册、验证码登录返回 `SaTokenInfo`。
- **分页**：`page` 从 1 开始，`pageSize` 默认 20、最大 100；返回 `PageResult{{currentPage, items, totalPages, totalItems, hasNext}}`。
- **时间**：响应时间字段均为毫秒时间戳；坐标为 GCJ-02（`gcjLng` / `gcjLat`）。
- **权限标注**：公开 / 登录 / 认证（学生认证）/ 认证或管理员 / 管理员。已登录但未同意当前政策版本时，除"同意前可用"的接口外都返回 20009。
- **乐观锁**：远程配置、版本线、公告的修改需要带读取时的 `revision` 作为 `expectedRevision`，被他人改过返回 20006，需要重新读取。

## 关键流程

1. **隐私政策同意**：`GET /auth/consent/policy` 取 `version`；注册与验证码登录带 `policyVersion`；发布新版本后老用户收到 20009，
   展示正文后 `POST /auth/consent/grant {{policyVersion}}`。
2. **图片上传**：`POST /upload/presign {{fileName, contentType, fileSize, biz}}` → `PUT putUrl` → `POST /upload/complete {{key}}` → 把 `key` 写进业务字段。
   biz：`avatar`、`restaurants`、`foods`、`comments`、`feedback`（`restaurants/foods/comments` 需学生认证）。
3. **学校统一认证**：`POST /auth/sdu` 发起 → 学校回跳结果页带 `ticket` → 登录状态下 `POST /auth/sdu/confirm {{ticket}}`。
4. **学校邮箱**：`POST /auth/sendEmail` → 邮件链接带 `token` → 登录状态下 `POST /auth/verifyEmail {{token}}`。
5. **密码登录人机验证**：失败过多返回 30015，完成腾讯验证码（`GET /auth/captcha/config`）后带 `X-Captcha-Ticket`、`X-Captcha-Randstr` 重试。
6. **反馈与举报**：用户提交 → 管理端 `GET /admin/feedback/cases` 处理队列 → `POST .../resolution` 关闭并给提交人发 SYSTEM 通知。
7. **公告**：管理端新建公告并勾选 `notifyUsers` 时，后端后台分批（每批 500 人）给全部活跃用户写通知卡片，可断点续发，不重复。

## 接入概况

客户端操作 {total} 项（另有 8 项学校认证浏览器回跳），前端已接入 **{used}** 项。未接入的 {total-used} 项及原因见文末。

## 接口列表
"""

tail = ["\n## 未接入的接口\n", "| 方法 | 路径 | 说明 | 原因 |", "| --- | --- | --- | --- |"]
REASONS = {
    "POST /auth/register": "后端已关闭用户名注册（30014），统一走手机号验证码注册",
    "POST /push/bindings": "Web 端暂无推送服务商令牌，留给 App 接入",
    "POST /push/bindings/{id}/token": "同上",
    "POST /push/bindings/{id}/unbind": "同上",
    "GET /user/blocks/{userId}": "他人主页已从 `GET /user/userInfo` 的 `blocked` 字段得到屏蔽状态",
    "GET /auth/consent": "同意状态由 20009 业务码驱动，无需单独查询",
    "GET /hub/locate": "不需要：店铺所属商圈由后端按坐标自动计算",
}
for m, p, s in rows_unused:
    tail.append(f"| {m} | `{p}` | {s} | {REASONS.get(f'{m} {p}', '待评估')} |")
if codes:
    tail += ["\n## 业务码\n", "| code | 枚举名 | 默认文案 |", "| --- | --- | --- |"]
    tail += [f"| {c} | `{n}` | {t} |" for n, c, t in codes]

open(out, "w").write(head + "\n".join(lines) + "\n" + "\n".join(tail) + "\n")
print(total, used, [f"{m} {p}" for m, p, _ in rows_unused])
