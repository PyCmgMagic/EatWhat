# 接口清单（当前契约）

唯一分析来源：`吃什么接口文档v2-openapi.yaml`，版本 `auth-renewal-20261019`。

共 101 个操作、90 个路径；旧版导出不参与本清单。

鉴权与角色列反映文档声明，未进行运行验证。`*` 表示参数必填；请求体是否必填单独列出。

请求头以登录返回的 tokenName 为准；当前为 `satoken: Bearer <tokenValue>`。

网关路径按 `/api` + 后端原始路径拼接：`/api/location/...` 经网关为 `/api/api/location/...`，不自动去重。

## /activity

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /activity/dinners` | 动态：获取聚餐动态列表 | SaToken（satoken 请求头） | — | query:page; query:pageSize | — | 200: Result_PageResult_ActivityDinnerDTOResponse; default: ErrorResponse |
| `POST /activity/dinners` | 动态：发布聚餐动态 | SaToken（satoken 请求头） + verified | — | — | CreateActivityDinnerDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /activity/dinners/by-likes` | 动态：按点赞排序聚餐动态 | SaToken（satoken 请求头） | — | query:page; query:pageSize | — | 200: Result_PageResult_ActivityDinnerDTOResponse; default: ErrorResponse |
| `DELETE /activity/dinners/{id}` | 动态：删除聚餐动态 | SaToken（satoken 请求头） + verified | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /activity/dinners/{id}` | 动态：获取聚餐动态详情 | SaToken（satoken 请求头） | — | path:id* | — | 200: Result_ActivityDinnerDTOResponse; default: ErrorResponse |
| `GET /activity/foods` | 动态：获取美食动态列表 | SaToken（satoken 请求头） | — | query:page; query:pageSize | — | 200: Result_PageResult_ActivityFoodDTOResponse; default: ErrorResponse |
| `POST /activity/foods` | 动态：发布美食动态 | SaToken（satoken 请求头） + verified | — | — | CreateActivityFoodDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /activity/foods/by-likes` | 动态：按点赞排序美食动态 | SaToken（satoken 请求头） | — | query:page; query:pageSize | — | 200: Result_PageResult_ActivityFoodDTOResponse; default: ErrorResponse |
| `DELETE /activity/foods/{id}` | 动态：删除菜品或美食动态 | SaToken（satoken 请求头） + verified | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /activity/foods/{id}` | 动态：获取菜品或美食动态详情 | SaToken（satoken 请求头） | — | path:id* | — | 200: Result_ActivityFoodDTOResponse; default: ErrorResponse |
| `POST /activity/likes` | 动态：点赞动态 | SaToken（satoken 请求头） + verified | — | — | ActivityLikeReqDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `DELETE /activity/likes` | 动态：取消动态点赞 | SaToken（satoken 请求头） + verified | — | — | ActivityLikeReqDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /activity/{provinceId}/foods` | 动态：按省份获取美食动态 | SaToken（satoken 请求头） | — | path:provinceId*; query:page; query:pageSize | — | 200: Result_PageResult_ActivityFoodDTOResponse; default: ErrorResponse |

## /admin

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /admin/food-tags` | 菜品标签管理：创建系统菜品标签 | SaToken（satoken 请求头） + admin | — | — | CreateSystemFoodTagDTORequest / 是 | 200: Result_FoodTagSummaryVOResponse; default: ErrorResponse |
| `GET /admin/food-tags` | 菜品标签管理：获取系统菜品标签 | SaToken（satoken 请求头） + admin | — | query:page; query:pageSize | — | 200: Result_PageResult_AdminFoodTagVOResponse; default: ErrorResponse |
| `DELETE /admin/food-tags/{id}` | 菜品标签管理：删除系统菜品标签 | SaToken（satoken 请求头） + admin | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `PUT /admin/food-tags/{id}` | 菜品标签管理：修改系统菜品标签 | SaToken（satoken 请求头） + admin | — | path:id* | UpdateSystemFoodTagDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /admin/summary` | 业务管理：获取业务统计 | SaToken（satoken 请求头） + admin | — | — | — | 200: Result_SummaryVOResponse; default: ErrorResponse |
| `GET /admin/sync/catalog/conflicts` | 目录冲突管理：列出未解决的目录冲突 | SaToken（satoken 请求头） + admin | app.sync.catalog.enabled=true | — | — | 200: Result_List_ConflictViewResponse; default: ErrorResponse |
| `GET /admin/sync/catalog/conflicts/objects` | 目录冲突管理：列出未解决的对象版本冲突 | SaToken（satoken 请求头） + admin | app.sync.catalog.enabled=true | — | — | 200: Result_List_ObjectHeadConflictViewResponse; default: ErrorResponse |
| `POST /admin/sync/catalog/conflicts/objects/{conflictId}/resolve` | 目录冲突管理：解决对象版本冲突 | SaToken（satoken 请求头） + admin | app.sync.catalog.enabled=true | path:conflictId* | ResolveHeadRequestRequest / 是 | 200: Result_ResolutionResultResponse; default: ErrorResponse |
| `POST /admin/sync/catalog/conflicts/{conflictId}/resolve` | 目录冲突管理：解决冲突 | SaToken（satoken 请求头） + admin | app.sync.catalog.enabled=true | path:conflictId* | ResolveRequestRequest / 是 | 200: Result_ResolutionResultResponse; default: ErrorResponse |
| `POST /admin/sync/catalog/import/hubs` | 目录导入管理：导入商场目录 | SaToken（satoken 请求头） + admin | app.sync.catalog.enabled=true | — | CatalogHubImportRequestRequest / 是 | 200: Result_CatalogImportResultResponse; default: ErrorResponse |
| `GET /admin/sync/profile-conflicts` | 资料冲突管理：获取列表 | SaToken（satoken 请求头） + admin | app.sync.profile.enabled=true | — | — | 200: Result_List_ConflictResponse; default: ErrorResponse |
| `POST /admin/sync/profile-conflicts/{conflictId}/resolve` | 资料冲突管理：解决冲突 | SaToken（satoken 请求头） + admin | app.sync.profile.enabled=true | path:conflictId* | ResolveRequestRequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |

## /api

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/location/provinces` | 省市位置：获取省份列表 | SaToken（satoken 请求头） | — | — | — | 200: Result_List_ProvinceDTOResponse; default: ErrorResponse |
| `GET /api/location/provinces/{provinceId}/cities` | 省市位置：获取省内城市列表 | SaToken（satoken 请求头） | — | path:provinceId* | — | 200: Result_List_CityDTOResponse; default: ErrorResponse |

## /auth

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /auth/callback` | 登录与认证：处理统一认证回调 | SaToken（satoken 请求头） | — | query:token* | — | 200: Result_HashMap_String_ObjectResponse; default: ErrorResponse |
| `POST /auth/callback` | 登录与认证：处理统一认证回调 | SaToken（satoken 请求头） | — | query:token* | — | 200: Result_HashMap_String_ObjectResponse; default: ErrorResponse |
| `POST /auth/changePassword` | 登录与认证：修改密码 | SaToken（satoken 请求头） | — | — | ChangePwdDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /auth/checkUsername` | 登录与认证：检查用户名是否可用 | 无会话要求声明 | — | query:username* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /auth/consent` | 跨站同步同意：获取当前跨站同意状态 | SaToken（satoken 请求头） | app.account.enabled=true | — | — | 200: ConsentReply; default: ErrorResponse |
| `POST /auth/consent/grant` | 跨站同步同意：授予跨站同步同意 | 无会话要求声明 | app.account.enabled=true | — | GrantRequestRequest / 是 | 200: ConsentReply; default: ErrorResponse |
| `GET /auth/consent/policy` | 跨站同步同意：读取跨站同意政策 | 无会话要求声明 | app.account.enabled=true | — | — | 200: ConsentPolicyReply; default: ErrorResponse |
| `POST /auth/consent/withdraw` | 跨站同步同意：撤回当前用户跨站同意 | SaToken（satoken 请求头） | app.account.enabled=true | — | — | 200: ConsentReply; default: ErrorResponse |
| `POST /auth/consent/withdraw-with-password` | 跨站同步同意：使用密码撤回跨站同意 | 无会话要求声明 | app.account.enabled=true | — | WithdrawalRequestRequest / 是 | 200: ConsentReply; default: ErrorResponse |
| `POST /auth/getCode` | 登录与认证：发送验证码 | SaToken（satoken 请求头） | — | query:mobile | — | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /auth/login` | 登录与认证：登录 | 无会话要求声明 | — | — | LoginDTORequest / 是 | 200: AuthReply; default: ErrorResponse |
| `POST /auth/logout` | 登录与认证：退出登录 | SaToken（satoken 请求头） | — | — | — | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /auth/register` | 登录与认证：注册 | 无会话要求声明 | — | — | RegisterDTORequest / 是 | 200: AuthReply; default: ErrorResponse |
| `GET /auth/sdu` | 登录与认证：跳转山东大学统一认证 | SaToken（satoken 请求头） | — | — | — | 200: Result_VoidResponse; default: ErrorResponse; 302:  |
| `POST /auth/sdu` | 登录与认证：跳转山东大学统一认证 | SaToken（satoken 请求头） | — | — | — | 200: Result_VoidResponse; default: ErrorResponse; 302:  |
| `GET /auth/sendEmail` | 登录与认证：发送邮箱验证链接 | SaToken（satoken 请求头） | — | query:email* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /auth/verify` | 登录与认证：查询已完成认证类型 | SaToken（satoken 请求头） | — | — | — | 200: Result_List_StringResponse; default: ErrorResponse |
| `GET /auth/verifyEmail` | 登录与认证：验证邮箱链接 | 无会话要求声明 | — | query:token* | — | 200: Result_VoidResponse; default: ErrorResponse; 302:  |

## /callback

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /callback` | Callback：处理统一认证回调 | SaToken（satoken 请求头） | — | query:token* | — | 200: Result_HashMap_String_ObjectResponse; default: ErrorResponse |
| `POST /callback` | Callback：处理统一认证回调 | SaToken（satoken 请求头） | — | query:token* | — | 200: Result_HashMap_String_ObjectResponse; default: ErrorResponse |

## /foods

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `DELETE /foods/delete/{id}` | 菜品与收藏：删除菜品或美食动态 | SaToken（satoken 请求头） + admin | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /foods/detail/{id}` | 菜品与收藏：获取菜品或美食动态详情 | SaToken（satoken 请求头） + verified | — | path:id* | — | 200: Result_FoodVOResponse; default: ErrorResponse |
| `PUT /foods/edit/{id}` | 菜品与收藏：修改菜品 | SaToken（satoken 请求头） + admin | — | path:id* | EditFoodDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /foods/favorites` | 菜品与收藏：获取收藏菜品 | SaToken（satoken 请求头） + verified | — | query:page; query:pageSize | — | 200: Result_PageResult_FoodVOResponse; default: ErrorResponse |
| `GET /foods/list` | 菜品与收藏：按餐厅筛选菜品 | SaToken（satoken 请求头） + verified | — | query:restaurantId*; query:page; query:pageSize; query:systemTagIds; query:myCustomTagIds; query:myCustomTagNames | — | 200: Result_PageResult_FoodVOResponse; default: ErrorResponse |
| `GET /foods/my` | 菜品与收藏：获取我的菜品 | SaToken（satoken 请求头） + verified | — | query:page; query:pageSize | — | 200: Result_PageResult_FoodVOResponse; default: ErrorResponse |
| `GET /foods/recommend` | 菜品与收藏：推荐菜品 | SaToken（satoken 请求头） + verified | — | query:limit | — | 200: Result_List_FoodVOResponse; default: ErrorResponse |
| `GET /foods/tags/my` | 菜品与收藏：获取个人菜品标签 | SaToken（satoken 请求头） + verified | — | query:page; query:pageSize | — | 200: Result_PageResult_MyCustomTagVOResponse; default: ErrorResponse |
| `DELETE /foods/tags/my/{tagId}` | 菜品与收藏：删除个人标签 | SaToken（satoken 请求头） + verified | — | path:tagId* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `PUT /foods/tags/my/{tagId}` | 菜品与收藏：重命名个人标签 | SaToken（satoken 请求头） + verified | — | path:tagId* | RenameCustomTagDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /foods/tags/system` | 菜品与收藏：获取系统菜品标签 | SaToken（satoken 请求头） + verified | — | — | — | 200: Result_List_FoodTagSummaryVOResponse; default: ErrorResponse |
| `POST /foods/upload` | 菜品与收藏：发布菜品 | SaToken（satoken 请求头） + verified | — | — | CreateFoodDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /foods/{id}/favorite` | 菜品与收藏：收藏菜品 | SaToken（satoken 请求头） + verified | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /foods/{id}/like` | 菜品与收藏：点赞菜品 | SaToken（satoken 请求头） + verified | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /foods/{id}/tags` | 菜品与收藏：获取菜品标签 | SaToken（satoken 请求头） + verified | — | path:id* | — | 200: Result_FoodTagViewVOResponse; default: ErrorResponse |
| `POST /foods/{id}/tags/custom` | 菜品与收藏：添加自定义菜品标签 | SaToken（satoken 请求头） + verified | — | path:id* | AddCustomFoodTagsDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /foods/{id}/tags/system` | 菜品与收藏：添加系统菜品标签 | SaToken（satoken 请求头） + verified | — | path:id* | AddSystemFoodTagsDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `DELETE /foods/{id}/tags/{tagId}` | 菜品与收藏：移除菜品标签 | SaToken（satoken 请求头） + verified | — | path:id*; path:tagId* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /foods/{id}/unfavorite` | 菜品与收藏：取消收藏菜品 | SaToken（satoken 请求头） + verified | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /foods/{id}/unlike` | 菜品与收藏：取消菜品点赞 | SaToken（satoken 请求头） + verified | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |

## /history

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /history/browse` | 浏览历史：获取浏览历史 | SaToken（satoken 请求头） + verified | — | query:targetType*; query:page; query:pageSize | — | 200: Result_PageResult_BrowseHistoryItemDTOResponse; default: ErrorResponse |

## /hub

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /hub/add` | 商场：新增商场 | SaToken（satoken 请求头） + admin | — | — | HubDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `DELETE /hub/delete/{id}` | 商场：删除商场 | SaToken（satoken 请求头） + admin | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /hub/detail/{id}` | 商场：获取商场详情 | SaToken（satoken 请求头） | — | path:id* | — | 200: Result_HubResponse; default: ErrorResponse |
| `PUT /hub/edit/{id}` | 商场：修改商场 | SaToken（satoken 请求头） + admin | — | path:id* | HubDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /hub/list` | 商场：获取商场列表 | SaToken（satoken 请求头） | — | query:keyword; query:page; query:pageSize | — | 200: Result_PageResult_HubResponse; default: ErrorResponse |
| `GET /hub/locate` | 商场：按位置查找商场 | SaToken（satoken 请求头） | — | query:gcjLng*; query:gcjLat* | — | 200: Result_HubResponse; default: ErrorResponse |
| `POST /hub/rebind-restaurants/{id}` | 商场：重新绑定商场内餐厅 | SaToken（satoken 请求头） + admin | — | path:id* | — | 200: Result_IntegerResponse; default: ErrorResponse |

## /notification

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /notification/list` | 通知：获取列表 | SaToken（satoken 请求头） | — | query:page; query:pageSize | — | 200: Result_PageResult_NotificationDTOResponse; default: ErrorResponse |
| `POST /notification/read/all` | 通知：标记全部通知已读 | SaToken（satoken 请求头） | — | — | — | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /notification/read/{id}` | 通知：标记单条通知已读 | SaToken（satoken 请求头） | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /notification/unread/count` | 通知：获取未读通知数 | SaToken（satoken 请求头） | — | — | — | 200: Result_LongResponse; default: ErrorResponse |

## /restaurant

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /restaurant/add` | 餐厅：新增餐厅 | SaToken（satoken 请求头） + verified | — | — | RestaurantDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `DELETE /restaurant/delete/{id}` | 餐厅：删除餐厅 | SaToken（satoken 请求头） + admin | — | path:id* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /restaurant/detail/{id}` | 餐厅：获取餐厅详情 | SaToken（satoken 请求头） + verified | — | path:id* | — | 200: Result_RestaurantResponse; default: ErrorResponse |
| `PUT /restaurant/edit/{id}` | 餐厅：修改餐厅 | SaToken（satoken 请求头） + admin | — | path:id* | EditRestaurantDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /restaurant/list` | 餐厅：获取管理用餐厅列表 | SaToken（satoken 请求头） + admin | — | query:keyword; query:hubId; query:page; query:pageSize | — | 200: Result_PageResult_RestaurantResponse; default: ErrorResponse |
| `GET /restaurant/search` | 餐厅：搜索附近餐厅 | SaToken（satoken 请求头） | — | query:keyword; query:hubId; query:gcjLng*; query:gcjLat*; query:radius; query:page; query:pageSize | — | 200: Result_PageResult_RestaurantResponse; default: ErrorResponse |

## /upload

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /upload/complete` | 文件上传：确认文件上传完成 | SaToken（satoken 请求头） | — | — | CompleteUploadRequestRequest / 是 | 200: Result_CompletedFileResponse; default: ErrorResponse |
| `POST /upload/presign` | 文件上传：申请单文件上传签名 | SaToken（satoken 请求头） | — | — | PresignUploadReqDTORequest / 是 | 200: Result_PresignUploadRespDTOResponse; default: ErrorResponse |
| `POST /upload/presign/batch` | 文件上传：申请批量上传签名 | SaToken（satoken 请求头） | — | — | PresignBatchUploadReqDTORequest / 是 | 200: Result_PresignBatchUploadRespDTOResponse; default: ErrorResponse |

## /user

| 方法与路径 | 说明 | 会话与角色 | 配置条件 | 参数 | 请求体 / 是否必填 | 响应模型 |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /user/ban/{userId}` | 用户与关注：封禁用户 | SaToken（satoken 请求头） + admin | — | path:userId* | BanUserDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /user/bindMobile` | 用户与关注：绑定手机 | SaToken（satoken 请求头） | — | — | BindMobileReqRequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /user/changePrivacy` | 用户与关注：修改隐私设置 | SaToken（satoken 请求头） | — | — | PrivacyDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /user/follow` | 用户与关注：关注用户 | SaToken（satoken 请求头） | — | query:userId* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /user/followers` | 用户与关注：获取粉丝列表 | SaToken（satoken 请求头） | — | query:userId; query:page; query:pageSize | — | 200: Result_PageResult_FansDTOResponse; default: ErrorResponse |
| `GET /user/followings` | 用户与关注：获取关注列表 | SaToken（satoken 请求头） | — | query:userId; query:page; query:pageSize | — | 200: Result_PageResult_FansDTOResponse; default: ErrorResponse |
| `POST /user/getCode` | 用户与关注：发送验证码 | SaToken（satoken 请求头） | — | — | SendCodeReqRequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /user/info` | 用户与关注：获取当前用户资料 | SaToken（satoken 请求头） | — | — | — | 200: Result_UserInfoDTOResponse; default: ErrorResponse |
| `GET /user/list` | 用户与关注：获取用户管理列表 | SaToken（satoken 请求头） + admin | — | query:page; query:pageSize | — | 200: Result_PageResult_UserListItemVOResponse; default: ErrorResponse |
| `POST /user/unban/{userId}` | 用户与关注：解除用户封禁 | SaToken（satoken 请求头） + admin | — | path:userId* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `POST /user/unfollow` | 用户与关注：取消关注用户 | SaToken（satoken 请求头） | — | query:userId* | — | 200: Result_VoidResponse; default: ErrorResponse |
| `PUT /user/updateInfo` | 用户与关注：更新当前用户资料 | SaToken（satoken 请求头） | — | — | UpdateUserInfoDTORequest / 是 | 200: Result_VoidResponse; default: ErrorResponse |
| `GET /user/userInfo` | 用户与关注：获取其他用户资料 | SaToken（satoken 请求头） | — | query:userId* | — | 200: Result_OtherUserInfoDTOResponse; default: ErrorResponse |

