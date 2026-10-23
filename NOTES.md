# 还原依据

- 来源：用户提供的本地 `prototype/screens/`、`prototype/design-system/`、`prototype/assets/`，共 51 张画板。以本地较新内容为准，不使用旧在线设计替代。
- 已有旧方案在 `design/`，本次仅以新移动端规范指导正式前端。
- 原始 DCLogic 模板需要未提供的 support.js。通过标准库编译为 React 树与控制器，复用真实 HTML/CSS/SVG，前端运行不依赖外部设计服务。
- 字体本地托管；颜色、图标和插画来自本地原型。原始源文件未修改。
- 浏览器验证使用独立 Playwright CLI。内置浏览器的控制桥不可用，未通过其他方式接管用户浏览器。
- 详细映射、边界、复现方式见 `docs/移动端原型还原与实现.md` 和 `frontend/README.md`。
