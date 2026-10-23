# 原型

「沙软今天吃什么」的界面设计，取自 Claude Design 上两个工程的最新发布版（2026-10-22）。

| 目录 | 内容 | 在线版 |
| --- | --- | --- |
| `design-system/` | 舞台设计规范。`README.md` 是总规则；`tokens.json` 是颜色、字体、间距、圆角、阴影、动效令牌；`components/<Name>/` 是组件说明（`README.md`）与预览（`preview.html`）；`assets/<Group>/README.md` 是各组资源的说明 | [舞台设计规范](https://claude.ai/artifact/6Hpr9PXH5f9Db7YC7ubjH4) |
| `screens/` | 画布「G 定稿」页的 51 张画板；`canvas.json` 记录画板标题与排布 | [风格候选](https://claude.ai/artifact/1cGfzwxyrkovZSZkA5ftqG) |
| `assets/` | 画板与组件引用的资源：菜品插画（`dishes/*.svg`）、实拍示例图（`photos/*.png`）、图标（`icons/*.svg`，MingCute Line，按用途命名） | |

## 画板

**底部三个主页面 + 消息**

| 文件 | 页面 |
| --- | --- |
| `G2-Home.dc.html` | 发现 |
| `G-Nearby.dc.html` | 附近 |
| `G-Me.dc.html` | 我的 |
| `G-Inbox.dc.html` | 消息 |

**详情与发布流程**

| 文件 | 页面 |
| --- | --- |
| `G-Dish.dc.html` | 菜品详情 |
| `G-Detail.dc.html` | 餐厅详情 |
| `G-PickShop.dc.html` | 发布 1/2 · 选店 |
| `G-AddDish.dc.html` | 发布 2/2 · 加菜 |

**登录与组件**

| 文件 | 页面 |
| --- | --- |
| `G-Login.dc.html` | 登录 |
| `G-Kit.dc.html` | 组件表 |
| `G-Nav.dc.html` | 底部导航（发现、附近、我的共用） |

**实拍图怎么处理**

| 文件 | 页面 |
| --- | --- |
| `G-HomePhoto.dc.html` | 发现（实拍图版） |
| `G-Crop.dc.html` | 发布 · 调整照片 |
| `G-PhotoPipeline.dc.html` | 实拍图从上传到上舞台的处理流程 |

**登录、注册与认证**

| 文件 | 页面 |
| --- | --- |
| `G-PhoneLogin.dc.html` | 注册（手机号、验证码、用户名、密码） |
| `G-RegisterConfirm.dc.html` | 新号码完成注册 |
| `G-PasswordLogin.dc.html` | 账号密码登录（手机号或用户名） |
| `G-ForgotPassword.dc.html` | 找回密码 |
| `G-DataNotice.dc.html` | 数据存放说明 |
| `G-Reconsent.dc.html` | 重新同意 |
| `G-Verify.dc.html` | 认证 |

**底部面板**

| 文件 | 页面 |
| --- | --- |
| `G-PanelPlace.dc.html` | 地点和饭点 |
| `G-PanelFilter.dc.html` | 附近筛选 |
| `G-PanelTag.dc.html` | 加标签 |
| `G-PanelReport.dc.html` | 举报 |

**搜索、专题、评论与店**

| 文件 | 页面 |
| --- | --- |
| `G-Search.dc.html` | 搜索 |
| `G-TopicArchive.dc.html` | 往期专题 |
| `G-Topic.dc.html` | 专题 |
| `G-Comments.dc.html` | 全部评论 |
| `G-WriteComment.dc.html` | 写评论 |
| `G-NewShop.dc.html` | 新建店 |
| `G-WrongInfo.dc.html` | 信息有误 |

**他人主页与我的子页**

| 文件 | 页面 |
| --- | --- |
| `G-UserProfile.dc.html` | 他人主页 |
| `G-Follows.dc.html` | 粉丝与关注 |
| `G-EditProfile.dc.html` | 编辑资料 |
| `G-MyTags.dc.html` | 我的标签 |
| `G-TagDishes.dc.html` | 标签下的菜 |
| `G-History.dc.html` | 足迹 |

**设置**

| 文件 | 页面 |
| --- | --- |
| `G-Settings.dc.html` | 设置 |
| `G-SettingsAccount.dc.html` | 账号与安全 |
| `G-ChangePhone.dc.html` | 换手机号 |
| `G-ChangePassword.dc.html` | 修改密码 |
| `G-Devices.dc.html` | 登录设备 |
| `G-DeleteAccount.dc.html` | 注销账号 |
| `G-SettingsPrivacy.dc.html` | 隐私 |
| `G-Blocked.dc.html` | 屏蔽的人 |
| `G-SettingsNotify.dc.html` | 通知 |
| `G-SettingsAbout.dc.html` | 关于 |
| `G-Feedback.dc.html` | 反馈 |

**图标**

| 文件 | 页面 |
| --- | --- |
| `G-Icons.dc.html` | 图标表（MingCute Line） |
| `G-Icon.dc.html` | 图标组件（其他画板共用） |

## 阅读方式

- `.dc.html` 依赖 Claude Design 的运行时（`support.js`、`<dc-import>`、`<sc-for>`、`<sc-if>`、`{{…}}` 绑定），本地直接打开只能看到静态标记和样式。看交互、动效请打开在线版。
- 读源码时，结构和样式看 HTML 与内联 CSS，交互逻辑看文件末尾 `<script type="text/x-dc">` 里继承 `DCLogic` 的类。
- `G-Nav.dc.html` 由发现、发现（实拍图版）、附近、我的和组件表通过 `<dc-import name="G-Nav">` 引入；图标统一通过 `<dc-import name="G-Icon" icon="…">` 引入，`G-Icon.dc.html` 里内联了全部 78 个图标的路径。其他画板之间只用 `href` 互相跳转。
- 组件预览 `preview.html` 用的是 `tokens.json` 注入的 CSS 变量（如 `var(--ink)`），同样要在在线版里看。
- 在线版里的 `/_blob/<id>` 资源引用已改写为指向 `assets/` 的相对路径，其余内容与发布版一致。`design-system/design-system.json` 的 `blob` 字段仍是在线版的资源 ID。
- 设计规范里说的 `assets/Icons`、`assets/Dishes`、`assets/Photos` 分别对应本目录的 `assets/icons/`、`assets/dishes/`、`assets/photos/`；图标文件名与规范里的用途名一致，`design-system/assets/Icons/README.md` 有和 MingCute 原名的对照表。
- 第一轮、第二轮的风格候选（A–I）只保留在在线画布里，没有收进仓库。

## 更新

设计以在线版为准。在线版改过之后，重新导出覆盖本目录，并按上面的规则改写资源路径。

2026-10-22 导出之后，本目录直接改过下面这些画板，在线版还没跟上；重新导出前先把这些改动同步到在线版，否则会被覆盖：

- 登录方式改成手机号或用户名加密码，注册要手机号，山大统一认证只用来做学生认证：`G-Login` 去掉统一认证登录，`G-PhoneLogin` 改成注册页，`G-PasswordLogin` 改成账号密码登录，`G-SettingsAccount` 加用户名、改成修改密码，`G-Settings` 改退出确认的文案；新增 `G-ForgotPassword`、`G-ChangePassword`、`G-ChangePhone`。
- `G-Dish` 加了收藏按钮和评论入口，`G-AddDish` 加了「说两句」。
