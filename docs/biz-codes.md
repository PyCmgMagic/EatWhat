# 业务码列表

来源：[`BizCode.java`](../../src/main/java/you/v50to/eatwhat/data/enums/BizCode.java)。新增或修改业务码时请同步更新本文档。

## 响应格式

业务接口统一返回 HTTP 200 + `Result` 包装：

```json
{ "code": 0, "data": {}, "msg": "ok", "timestamp": 1761100000000 }
```

- `code=0` 表示成功，非零为业务错误；**不要只按 HTTP 200 判断成功**。
- `msg` 默认是下表中的默认文案；带附加信息时格式为 `默认文案：附加信息`（全角冒号），例如 `参数非法：手机号格式不正确`。前端应按 `code` 分支，`msg` 仅用于展示。
- 大多数错误的 `data` 为 `null`；少数错误会在 `data` 中携带结构化结果（见下文“携带 data 的错误”）。
- 认证相关接口（`AuthController`、`CallbackController`、`AccountConsentController`）由 `AuthPrivacyExceptionHandler` 处理，只透出白名单内的附加信息，其余情况只返回默认文案。

## 业务码总表

### 0 成功

| code | 枚举名 | 默认文案 |
| --- | --- | --- |
| 0 | `SUCCESS` | ok |

### 1xxxx 通用错误

| code | 枚举名 | 默认文案 | 说明 |
| --- | --- | --- | --- |
| 10001 | `PARAM_INVALID` | 参数非法 | 参数校验失败、请求体无法解析、参数类型不匹配；校验失败时附带字段校验文案 |
| 10002 | `PARAM_MISSING` | 参数缺失 | 必填参数为空，如 `scene不能为空`、`手机号不能为空` |
| 10003 | `TOO_MANY_REQUESTS` | 请求频率过高 | 限流，如短信发送过于频繁 |
| 10004 | `NOT_SUPPORTED` | 不支持的操作 | 当前部署模式或场景不支持该操作 |

### 2xxxx 认证与鉴权

| code | 枚举名 | 默认文案 | 说明 / 前端处理 |
| --- | --- | --- | --- |
| 20001 | `NOT_LOGIN` | 用户未登录 | Sa-Token 未登录；清理本地会话，跳转登录 |
| 20002 | `TOKEN_INVALID` | Token 无效 | 预留，当前代码未使用 |
| 20003 | `TOKEN_EXPIRED` | Token 已过期 | 预留，当前代码未使用 |
| 20004 | `NO_PERMISSION` | 权限不足 | 角色/权限不足；附加信息可能为 `用户未验证`、`需要管理员权限`、`权限不足` |
| 20005 | `CROSS_BORDER_CONSENT_REQUIRED` | 需要跨境同步同意 | 读取当前政策并展示同意操作；`data` 中的 `consentProof` 只用于 grant，不是业务 token |
| 20006 | `DATA_SYNC_PENDING` | 账号正在等待协调或同步 | 显示等待；`registrationAccepted=true` 表示已受理，避免重复提交；有限次数退避重试 |
| 20007 | `AUTH_UNAVAILABLE` | 身份验证暂不可用 | 保留输入，提示稍后重试，不要无限轮询 |
| 20008 | `CONSENT_PROOF_INVALID` | 同意凭证无效或已过期 | 重新登录获取新的临时凭证 |
| 20009 | `CONSENT_POLICY_CHANGED` | 同意政策已更新 | 重新读取政策，再由用户确认同意 |
| 20010 | `ACCOUNT_AUTHORIZATION_EXPIRED` | 账号授权已过期，请重新验证 | 清理失效会话并重新登录；不得自动代替用户续同意 |
| 20011 | `ACCOUNT_SECURITY_CONFLICT` | 账号存在并发密码冲突，请在本站通过已验证邮箱恢复 | 多站点并发修改密码产生冲突，引导用户走邮箱恢复 |

> 注：`DATA_SYNC_PENDING (20006)` 虽归在 2xxxx 段，但也被目录导入、目录/资料冲突处理、偏好、关系等同步写路径使用，表示“已受理但尚未完成同步/协调”。

### 3xxxx 用户模块

| code | 枚举名 | 默认文案 | 说明 |
| --- | --- | --- | --- |
| 30001 | `USER_NOT_FOUND` | 用户不存在 | |
| 30002 | `USER_DISABLED` | 用户被禁用 | 包括 Sa-Token 的封禁异常 |
| 30003 | `USERNAME_EXISTS` | 用户名已存在 | 注册 / 修改用户名 |
| 30004 | `PASSWORD_ERROR` | 密码错误 | |
| 30005 | `VERIFY_CODE_ERROR` | 验证码错误 | 短信 / 邮箱验证码 |
| 30006 | `EMAIL_ALREADY_VERIFIED` | 该用户已通过邮箱验证 | |
| 30007 | `EMAIL_INVALID` | 邮箱格式不正确 | |
| 30008 | `EMAIL_TOKEN_INVALID` | 邮箱验证链接无效或已过期 | |
| 30009 | `EMAIL_NOT_SDU` | 仅支持山东大学邮箱（@sdu.edu.cn 或 @mail.sdu.edu.cn） | |

### 4xxxx 业务逻辑错误

| code | 枚举名 | 默认文案 | 说明 |
| --- | --- | --- | --- |
| 40001 | `OP_FAILED` | 操作失败 | 通用业务失败，通常带附加信息 |
| 40002 | `STATE_NOT_ALLOWED` | 当前状态不允许该操作 | |
| 40003 | `RESOURCE_NOT_ENOUGH` | 资源不足 | 预留，当前代码未使用 |
| 40004 | `DUPLICATE_SUBMIT` | 重复提交 | 预留，当前代码未使用 |
| 40005 | `CITY_PROVINCE_MISMATCH` | 城市与省份不匹配 | |
| 40006 | `PROVINCE_NOT_FOUND` | 省份不存在 | |
| 40007 | `CITY_NOT_FOUND` | 城市不存在 | |
| 40008 | `FOOD_NOT_FOUND` | 菜品不存在 | |
| 40009 | `RESTAURANT_NOT_FOUND` | 餐厅不存在 | |
| 40010 | `HUB_NOT_FOUND` | 商场不存在 | |

### 5xxxx 外部依赖错误

| code | 枚举名 | 默认文案 | 说明 |
| --- | --- | --- | --- |
| 50001 | `THIRD_PARTY_UNAVAILABLE` | 第三方服务不可用 | 如 `短信服务不可用`、对象存储不可用 |
| 50002 | `THIRD_PARTY_TIMEOUT` | 第三方接口超时 | 如 `短信服务请求超时` |
| 50003 | `THIRD_PARTY_BAD_RESPONSE` | 第三方返回异常 | 统一认证回调等第三方返回异常，可能携带 `data` |

### 9xxxx 系统级错误

| code | 枚举名 | 默认文案 | 说明 |
| --- | --- | --- | --- |
| 90001 | `SYSTEM_ERROR` | 系统内部异常 | 预留，当前代码未使用 |
| 90002 | `DB_ERROR` | 数据库异常 | SQL 语法错误时返回 `数据库异常：数据库未初始化或表不存在` |
| 90003 | `REDIS_ERROR` | Redis 异常 | 预留，当前代码未使用 |
| 90004 | `UNKNOWN_ERROR` | 未捕获异常 | 全局兜底，所有未处理异常 |

## 携带 data 的错误

以下情况 `code != 0` 但 `data` 非空，前端需先判断 `code` 再读取 `data`：

| code | 场景 | data 内容 |
| --- | --- | --- |
| 20005 | 登录需要跨境同意 | 可能包含 `consentProof`、授权进度字段 |
| 20006 | 注册/登录等待协调 | 账号授权视图，如 `registrationAccepted`、`status` |
| 20006 | 目录导入、目录冲突处理（`CatalogImportController`、`CatalogConflictController`） | 同步处理结果，`status != APPLIED` |
| 50003 | 统一认证回调异常（`AuthService`） | 回调结果数据 |

## 异常到业务码的映射

| 异常 | 业务码 |
| --- | --- |
| `BizException(bizCode[, extraMsg])` | 对应 `bizCode`，`msg` 为异常消息 |
| Sa-Token `NotLoginException` | 20001 |
| Sa-Token `DisableServiceException` | 30002 |
| Sa-Token `NotRoleException` / `NotPermissionException` | 20004 |
| `MethodArgumentNotValidException` | 10001（附字段校验文案） |
| `MethodArgumentTypeMismatchException`、`HttpMessageNotReadableException` | 10001 |
| `BadSqlGrammarException` | 90002 |
| `AccountUnavailableException`、`ConsentStore.ConsentException`（认证接口内） | 20007 |
| 其他 `Exception` | 90004 |

## 非 Result 格式的错误码（HTTP 非 200）

集群网关和授权拦截不走 `Result` 包装，而是返回非 200 状态，响应体只有字符串 `code`：

| HTTP | code | 来源 | 含义 |
| --- | --- | --- | --- |
| 503 | `SITE_ENROLLMENT_REQUIRED` | `ManagedEnrollmentGate` | 站点尚未完成集群注册，业务接口暂不可用 |
| 401 | `AUTHENTICATION_REQUIRED` | `ClusterExceptionHandler` | 集群管理接口未登录 |
| 403 | `ADMIN_REQUIRED` | `ClusterExceptionHandler` | 集群管理接口需要管理员 |
| 400 | `INVALID_CLUSTER_REQUEST` | `ClusterExceptionHandler` | 集群请求参数非法 |
| 503 | `CLUSTER_STORAGE_UNAVAILABLE` | `ClusterExceptionHandler` | 集群存储不可用 |
| 500 | `CLUSTER_REQUEST_FAILED` | `ClusterExceptionHandler` | 集群请求未知失败 |

控制面（`control` 包）的任务状态码（如 `OUTCOME_UNKNOWN`、`BOOTSTRAP_PHASE_FAILED_PRESERVED` 等）属于运维接口，见 [control-api.md](../architecture/control-api.md)，不在本文档范围内。
