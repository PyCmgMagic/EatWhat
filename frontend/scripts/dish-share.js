async function validateDishShare(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("请在本地开发页面运行");
  const checks = [],
    errors = [];
  for (const width of [320, 390, 520]) {
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 844 },
        reducedMotion: "reduce",
      });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin !== base || url.pathname.startsWith("/api/")
        ? route.abort()
        : route.continue();
    });
    try {
      for (const mode of [
        "native",
        "copy-native",
        "rejected",
        "unsupported",
        "cancelled",
        "clipboard-missing",
        "clipboard-denied",
      ]) {
        await p.goto(`${base}/?demo=1&view=mobile#/foods/1`);
        await p
          .getByRole("button", { name: "分享菜品", exact: true })
          .waitFor();
        await p.evaluate((mode) => {
          window.shareCalls = [];
          window.copiedLinks = [];
          const native = async (data) => {
            window.shareCalls.push(data);
            if (mode === "cancelled")
              throw new DOMException("取消", "AbortError");
            if (!["native", "copy-native"].includes(mode))
              throw new DOMException("系统分享不可用", "NotAllowedError");
          };
          Object.defineProperty(navigator, "share", {
            configurable: true,
            value: ["unsupported", "clipboard-missing"].includes(mode)
              ? undefined
              : native,
          });
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value:
              mode === "clipboard-missing"
                ? undefined
                : {
                    writeText: async (text) => {
                      if (mode === "clipboard-denied")
                        throw new DOMException("无复制权限", "NotAllowedError");
                      window.copiedLinks.push(text);
                    },
                  },
          });
        }, mode);
        await p.getByRole("button", { name: "分享菜品", exact: true }).click();
        const sheet = p.getByRole("dialog", { name: "分享", exact: true });
        await sheet.waitFor();
        await sheet.getByText("鲜虾蟹籽云吞", { exact: true }).waitFor();
        const untouched = await p.evaluate(
          () =>
            window.shareCalls.length === 0 && window.copiedLinks.length === 0,
        );
        if (!untouched) throw new Error("打开分享选项时不应分享或复制");
        if (
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          )
        )
          throw new Error(`${width}px 分享选项横向溢出`);
        if (width === 390 && mode === "native")
          await p.screenshot({
            path: "output/playwright/dish-share-options.png",
          });
        await sheet
          .getByRole("button", {
            name:
              mode === "copy-native" || mode.startsWith("clipboard-")
                ? "复制链接"
                : "分享给朋友",
            exact: true,
          })
          .click();
        if (["rejected", "unsupported"].includes(mode)) {
          await p
            .getByText(
              mode === "unsupported"
                ? "当前浏览器不支持直接分享，请复制链接"
                : "分享未完成，请重试或复制链接",
              { exact: true },
            )
            .waitFor();
          if (await p.evaluate(() => window.copiedLinks.length !== 0))
            throw new Error("直接分享不可用时不应自动复制链接");
          await sheet
            .getByRole("button", { name: "复制链接", exact: true })
            .click();
        }
        if (mode.startsWith("clipboard-")) {
          const dialog = sheet;
          await dialog.waitFor();
          const input = dialog.getByRole("textbox", {
            name: "分享链接",
            exact: true,
          });
          if ((await input.inputValue()) !== p.url())
            throw new Error("手动复制的菜品链接不正确");
          if (
            await p.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            )
          )
            throw new Error(`${width}px 分享弹窗横向溢出`);
          if (width === 390 && mode === "clipboard-missing")
            await p.screenshot({
              path: "output/playwright/dish-share-manual.png",
            });
          await dialog
            .getByRole("button", { name: "复制链接", exact: true })
            .click();
          await p.getByText("请长按选中的链接复制", { exact: true }).waitFor();
          if (
            !(await p.evaluate(() => {
              const input = document.activeElement;
              return (
                input instanceof HTMLInputElement &&
                input.selectionStart === 0 &&
                input.selectionEnd === input.value.length
              );
            }))
          )
            throw new Error("手动复制时未选中链接");
          await p.evaluate(() =>
            Object.defineProperty(navigator, "clipboard", {
              configurable: true,
              value: {
                writeText: async (text) => window.copiedLinks.push(text),
              },
            }),
          );
          await dialog
            .getByRole("button", { name: "复制链接", exact: true })
            .click();
          await dialog.waitFor({ state: "hidden" });
          await p.getByText("链接已复制", { exact: true }).waitFor();
        } else if (mode === "cancelled") {
          await sheet.waitFor();
          if (
            !(await sheet
              .getByRole("button", { name: "复制链接", exact: true })
              .isEnabled())
          )
            throw new Error("取消分享后应可以重新选择");
        } else if (mode !== "native") {
          await p.getByText("链接已复制", { exact: true }).waitFor();
        } else await sheet.waitFor({ state: "hidden" });
        const result = await p.evaluate(() => ({
          shared: window.shareCalls,
          copied: window.copiedLinks,
        }));
        if (mode === "native" || mode === "cancelled") {
          if (result.shared.length !== 1 || result.copied.length)
            throw new Error(`${mode}: 系统分享或取消状态不正确`);
        } else if (result.copied.length !== 1 || result.copied[0] !== p.url())
          throw new Error(`${mode}: 未正确复制菜品链接`);
        if (mode === "copy-native" && result.shared.length)
          throw new Error("选择复制链接时不应调用系统分享");
        if (
          result.shared.length &&
          (result.shared[0].url !== p.url() ||
            result.shared[0].title !== "鲜虾蟹籽云吞")
        )
          throw new Error("系统分享缺少菜品名称或链接");
        checks.push(`${width}px ${mode}: 分享及回退反馈正常`);
        await p.reload();
      }
      await p.goto(`${base}/?demo=1&view=mobile#/restaurants/1`);
      const shopShare = p.getByRole("button", { name: "分享", exact: true });
      await shopShare.waitFor();
      await shopShare.click();
      const shopSheet = p.getByRole("dialog", { name: "分享", exact: true });
      await shopSheet.waitFor();
      if (
        (await shopSheet.locator(".share-sheet-subject").innerText()).trim() ===
        ""
      )
        throw new Error("餐厅分享缺少名称");
      if (width === 390)
        await p.screenshot({
          path: "output/playwright/shop-share-options.png",
        });
      await shopSheet
        .getByRole("button", { name: "关闭分享", exact: true })
        .click();
      await shopSheet.waitFor({ state: "hidden" });
      if (
        !(await shopShare.evaluate(
          (element) => element === document.activeElement,
        ))
      )
        throw new Error("关闭分享后未返回分享入口");
      await shopShare.click();
      await shopSheet.waitFor();
      await p.keyboard.press("Escape");
      await shopSheet.waitFor({ state: "hidden" });
      await shopShare.click();
      await shopSheet.waitFor();
      await p.mouse.click(10, 10);
      await shopSheet.waitFor({ state: "hidden" });
      await shopShare.click();
      await shopSheet.waitFor();
      const handle = await shopSheet
        .getByRole("button", { name: "关闭分享选项", exact: true })
        .boundingBox();
      await p.mouse.move(handle.x + handle.width / 2, handle.y + 14);
      await p.mouse.down();
      await p.mouse.move(handle.x + handle.width / 2, handle.y + 180, {
        steps: 8,
      });
      await p.mouse.up();
      await shopSheet.waitFor({ state: "hidden" });
      await p.evaluate(() => {
        window.copiedLinks = [];
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: async (text) => window.copiedLinks.push(text) },
        });
      });
      await shopShare.click();
      await shopSheet.waitFor();
      await shopSheet
        .getByRole("button", { name: "复制链接", exact: true })
        .click();
      await shopSheet.waitFor({ state: "hidden" });
      const shopLinks = await p.evaluate(() => window.copiedLinks);
      if (shopLinks.length !== 1 || shopLinks[0] !== p.url())
        throw new Error("未正确复制餐厅链接");
      checks.push(`${width}px 餐厅复制及关闭、Esc、遮罩、下滑正常`);
    } finally {
      await context.close();
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return { checks, errors, realShares: 0 };
}
