# 验证码发送的人机验证：腾讯云国际站 CAPTCHA

本次替换此前尚未部署的 Google reCAPTCHA 接入。服务端固定调用 `https://captcha.intl.tencentcloudapi.com/`，Action 为 `DescribeCaptchaResult`，API Version 为 `2019-07-22`，`CaptchaType` 固定为 `9`。签名、时间戳及公共请求头由腾讯官方 common SDK 的 TC3-HMAC-SHA256 实现处理。

已支持控制台同时开启「CaptchaAppId 强制校验」和「一次一密校验」：每次配置查询都会在后端生成全新的 `aidEncrypted`。

2026-10-24 已携带用户填写的配置部署到校内和新加坡业务站，配置、票据拦截及公网接口验收通过，详见 [两站发布记录](tencent-captcha-rollout-20261024.md)。真实人工挑战成功后的发送仍待前端验收。当前仓库只有业务后端和管理控制台，业务客户端需要按本契约接入腾讯验证组件。

## 保护范围

以下入口每次发送前都必须完成服务端票据校验。原请求体、请求参数、登录要求、用途校验及短信、邮箱限流继续使用。

| 接口（相对 `/api`） | 用途 |
| --- | --- |
| `POST /auth/phone/code` | 匿名手机号登录、自动注册的短信验证码 |
| `POST /auth/getCode` | 已登录、已认证账号的旧短信入口 |
| `POST /auth/password/code` | 设置登录名、设置或修改密码的绑定手机验证码 |
| `POST /user/getCode` | 手机绑定等按 scene 发送的短信验证码 |
| `GET /auth/sendEmail` | 学校邮箱验证链接 |
| `POST /auth/password-conflict/challenge` | 多写账号密码冲突恢复邮件（该功能开启时） |

所有入口统一使用以下请求头，值来自**同一次**腾讯前端回调：

```http
X-Captcha-Ticket: <callback.ticket>
X-Captcha-Randstr: <callback.randstr>
```

客户端不能提供 `UserIp`、`CaptchaAppId` 或密钥来覆盖服务端配置。`UserIp` 使用现有 `IpUtil.getClientIp(request)` 获取的地址，必须是有效 IP 字面量，不能把示例里的 `127.0.0.1` 写死。生产反向代理应按现有网络拓扑清洗、设置真实 IP 请求头，业务进程只能通过可信入口访问。

服务端只有在 `Response.CaptchaCode` 为整数 `1`，且返回的 `EvilLevel` 未表明恶意时才发送。**外层 `retcode=0` 或 HTTP 200 不表示人机验证成功**；官网示例里的 `CaptchaCode=0` 不能放行。

票据错误、Randstr 不匹配、过期、重复使用和风险拒绝均停止发送。`trerror_` 开头的前端容灾票据同样不能触发发送。配置缺失、上游鉴权失败、超时、网络错误、异常响应均不放行。不会缓存成功结果，也不会自动重试票据校验；请求失败后客户端必须重新验证。腾讯上游负责票据有效期和单次使用限制，票据不进入业务数据库或站点间同步事件。

## 服务端配置

在腾讯云**国际站**创建适合 Web/App 的 CAPTCHA 应用，使用该应用自己的配置。用户提供的官网请求示例是参数说明，示例 AppId、AppSecretKey、Ticket 不能当作可用生产配置。

应用凭据和云 API 凭据是两组不同的配置：

| 环境变量 | 含义 |
| --- | --- |
| `TENCENT_CAPTCHA_ENABLED` | 默认 `true`，开启服务端校验 |
| `TENCENT_CAPTCHA_APP_ID` | CAPTCHA 应用 ID，公开给客户端 |
| `TENCENT_CAPTCHA_APP_SECRET_KEY` | CAPTCHA 应用的 AppSecretKey，仅服务端使用 |
| `TENCENT_CAPTCHA_SECRET_ID` | 国际站云 API SecretId，用于 API 签名 |
| `TENCENT_CAPTCHA_SECRET_KEY` | 配套云 API SecretKey，仅服务端使用 |
| `TENCENT_CAPTCHA_SESSION_TOKEN` | 使用临时云 API 凭据时的安全令牌；长期密钥留空 |
| `TENCENT_CAPTCHA_TIMEOUT` | 请求超时，默认 `5s`，允许 `1s`–`10s` |
| `TENCENT_CAPTCHA_AID_ENCRYPTED_TTL` | AppId 加密串有效期，默认 `120s`，允许整秒 `1s`–`86400s` |

对应属性前缀为 `app.captcha.tencent`，属性名为 `enabled`、`app-id`、`app-secret-key`、`secret-id`、`secret-key`、`session-token`、`timeout`、`aid-encrypted-ttl`。实际密钥通过受保护环境变量或外部配置文件注入，不能提交到仓库或发给客户端。云 API 凭据需要有调用 `captcha:DescribeCaptchaResult` 的权限。

两站 Compose 示例已透传上述变量。若现网使用其他 Compose、外部 properties 或配置生成器，需同步添加。此前 `RECAPTCHA_*` / `app.recaptcha.*` 配置不再使用；新的配置接口是 `/auth/captcha/config`。

缺少配置时应用仍可启动，但发送请求和公开配置查询会返回不可用，不会自动关闭校验。隔离测试可显式设 `TENCENT_CAPTCHA_ENABLED=false`，生产保持 `true`。

业务错误响应沿用 `Result`：

| code | 含义 | 客户端处理 |
| --- | --- | --- |
| `30015` | 缺少 ticket 或 randstr | 重新完成人机验证 |
| `30016` | 票据无效、过期、已用或风险拒绝 | 清空票据并重新验证 |
| `50004` | 人机验证暂不可用，包括配置和上游故障 | 停止发送并稍后重试 |

所有请求结束后，包括业务限流或网络中断，都丢弃本次 ticket/randstr，不能复用。

## AppId 强制校验与一次一密

`GET /api/auth/captcha/config` 不再只是静态配置，每次调用都会返回一份新的初始化凭证：

- 使用服务端已有 `AppSecretKey`，UTF-8 字节不足 32 字节时循环补齐到 32 字节；超过 32 字节会拒绝生成，避免静默使用错误密钥。
- 明文为 `CaptchaAppId&当前 Unix 秒&有效秒数`，通过 AES-256-CBC / PKCS7 填充加密，Java 使用等价的 `AES/CBC/PKCS5Padding`。
- 每次调用均通过 `SecureRandom` 生成新的 16 字节 IV，输出标准 Base64 编码的 `IV || 密文`，`aidEncryptedType` 为 `cbc`。
- 默认 120 秒有效，返回 `expiresAt`（Unix **秒**）供客户端识别初始化凭证的到期时间。这不是已经完成验证后 ticket 的有效期。
- 返回 `Cache-Control: no-store` 和 `Pragma: no-cache`。客户端、CDN、反向代理及 Service Worker 均不得缓存这个接口的响应。

「一次一密」由腾讯验证侧检查 IV 是否已使用；业务后端不缓存或重复签发同一份参数，也不需要把它保存到 Redis。前端每次创建验证实例必须重新查询本接口；取消、初始化异常、超时、发送失败后重试、重新打开弹窗、重新挂载组件，均需获取新的配置并创建新实例。不要对已经使用的实例调用 `reload()` / `show()` 来开始下一次验证，这可能复用旧的加密参数。组件内部刷新仍由官方 SDK 处理。

两站无需新增加密密钥，均使用各自现有配置。服务器时间需保持准确；未来时间戳会被腾讯拒绝。保持控制台这两个开关开启，并让前端传入下面示例中的 `aidEncrypted`、`aidEncryptedType` 即可。

## 业务前端接入

每次验证开始时匿名查询 `GET /api/auth/captcha/config`，成功时返回：

```json
{
  "code": 0,
  "data": {
    "enabled": true,
    "provider": "tencent-cloud-intl",
    "appId": "<实际应用ID>",
    "scriptUrl": "https://ca.turing.captcha.qcloud.com/TJNCaptcha-global.js",
    "aidEncrypted": "<本次有效的Base64加密串>",
    "aidEncryptedType": "cbc",
    "expiresAt": 1800000120
  }
}
```

此接口不返回 AppSecretKey、SecretId、SecretKey 或临时安全令牌。`aidEncrypted` 是交给腾讯前端 SDK 的短效加密参数，可以传给前端，但不能记录到日志、存入本地存储或与其他页面、标签页共用。仅前端 `ret=0` 不能触发放行，原有服务端 ticket/randstr 校验保持强制执行。

使用国际站当前 SDK，通过网络加载官方 JS，不将其复制进项目。以下 HTML 先加载 SDK，再执行接入代码。按钮示例需要替换为实际客户端的手机号校验、重发倒计时和错误提示函数。

```html
<script src="https://ca.turing.captcha.qcloud.com/TJNCaptcha-global.js"></script>
<div id="captcha-container"></div>
<button id="send-code" type="button">发送验证码</button>
```

```javascript
const sendButton = document.getElementById('send-code');
let busy = false;

async function beginLoginSmsVerification() {
  if (busy || !canResend()) return;
  const mobile = readValidatedMobile();
  busy = true;
  sendButton.disabled = true;
  let captcha;
  let handled = false;
  const finish = () => {
    try { captcha?.destroy(); }
    finally {
      busy = false;
      sendButton.disabled = !canResend();
    }
  };
  try {
    if (typeof TencentCaptcha !== 'function') throw new Error('人机验证加载失败');
    // 必须放在本次验证流程内：不共享 Promise，不缓存配置，不复用旧 aidEncrypted。
    const httpConfig = await fetch('/api/auth/captcha/config', { cache: 'no-store' });
    const result = await httpConfig.json();
    if (!httpConfig.ok || result.code !== 0 || !result.data?.enabled) {
      throw new Error('人机验证暂不可用');
    }
    const config = result.data;
    if (!config.aidEncrypted || config.aidEncryptedType !== 'cbc') {
      throw new Error('人机验证初始化参数缺失');
    }
    captcha = new TencentCaptcha(
      document.getElementById('captcha-container'),
      config.appId,
      async response => {
        if (handled) return;
        handled = true;
        try {
          if (response.ret === 2) return; // 用户取消；下次点击会重新取配置。
          if (response.ret !== 0 || response.errorCode || !response.ticket || !response.randstr
              || response.ticket.startsWith('trerror_')) {
            throw new Error('人机验证失败，请重试');
          }
          const httpResponse = await fetch('/api/auth/phone/code', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Captcha-Ticket': response.ticket,
              'X-Captcha-Randstr': response.randstr
            },
            body: JSON.stringify({ mobile })
          });
          const body = await httpResponse.json();
          if (!httpResponse.ok || body.code !== 0) throw new Error(body.msg || '发送失败');
          startResendCountdown();
        } catch (error) {
          showSendError(error);
        } finally {
          // 成功或失败均丢弃实例、加密串和票据。下次点击重新走完整流程。
          finish();
        }
      },
      { userLanguage: 'zh-cn', aidEncrypted: config.aidEncrypted, aidEncryptedType: config.aidEncryptedType }
    );
    captcha.show();
  } catch (error) {
    handled = true;
    finish();
    showSendError(error);
  }
}
sendButton.addEventListener('click', () => {
  beginLoginSmsVerification().catch(showSendError);
});
```

`canResend()`、`readValidatedMobile()`、`startResendCountdown()`、`showSendError()` 对接业务客户端已有逻辑；倒计时结束后由客户端更新按钮。SDK 加载失败时停止本次流程，不生成容灾票据来绕过校验。路由切换、组件卸载或业务主动关闭时也销毁当前实例并丢弃初始化参数；再次进入时创建新的流程。不要把上面的配置查询挪到页面全局、模块单例、HTTP 缓存或 Vue/React 的共享查询缓存中。

其他发送接口使用相同两个请求头，并保留原有登录头及请求参数。原生客户端也必须将腾讯 SDK 返回的 ticket、randstr 交给业务后端校验。

## 验证范围

```sh
mvn -o -B -Dtest=TencentCaptchaServiceTest,TencentCaptchaContractTest,TencentCaptchaConfigurationTest,PhoneAuthContractTest,AuthPrivacyContractTest,ApiSurfaceContractTest,AuthContractTest,AccountAuthContractTest,SduCallbackContractTest test
```

测试包含腾讯官方 CBC 固定向量兼容性、独立解密检查、短效参数、同秒多次生成时 IV 唯一、配置响应不缓存，以及官方 SDK 实际签名及请求序列化（通过本地拦截器，不访问外网）、六个入口的阻断及放行、过期/重放、风险、配置缺失、上游异常及敏感信息保护。没有发送真实短信或邮件。上线前仍需用真实前端应用验证两个站点：同时开启两个开关，确认首次和连续第二次人机验证正常；用户取消后重试会获取新加密串；故意复用旧参数时由腾讯拒绝。

官方参考：[国际站票据校验](https://www.tencentcloud.com/document/product/1159/50367)、[公共签名参数](https://www.tencentcloud.com/document/api/1159/50361)、[国际站 Web 客户端](https://intl.cloud.tencent.com/zh/document/product/1159/49680)、[AppId 加密及一次一密规则](https://cloud.tencent.com/document/product/1110/128489)。
