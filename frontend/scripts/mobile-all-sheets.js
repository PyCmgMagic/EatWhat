async function validateAllSheets(page) {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  const p = await context.newPage(),
    checks = [],
    errors = [];
  p.setDefaultTimeout(10000);
  p.on("pageerror", (error) => errors.push(error.message));
  const base = "http://127.0.0.1:5173/?demo=1&view=mobile#";
  const cdp = await context.newCDPSession(p);
  async function drag(handle, delta, cancel = false) {
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    const x = Math.round(box.x + box.width / 2),
      y = Math.round(box.y + 15);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 12; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: Math.max(3, y + (delta * i) / 12) }],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: cancel ? "touchCancel" : "touchEnd",
      touchPoints: [],
    });
  }
  async function settled(handle, open) {
    await p.waitForFunction(
      ({ label, state }) => {
        const control = Array.from(
          document.querySelectorAll(".mobile-sheet-handle"),
        ).find((e) => e.getAttribute("aria-label")?.endsWith(label));
        return (
          control?.getAttribute("aria-expanded") === String(state) &&
          !control.parentElement.hasAttribute("data-sheet-moving")
        );
      },
      {
        label: await handle.getAttribute("aria-label").then((v) => v.slice(2)),
        state: open,
      },
    );
  }
  try {
    for (const width of [320, 390, 520]) {
      await p.setViewportSize({ width, height: 844 });
      for (const [route, label] of [
        ["/", "推荐内容"],
        ["/home-photo", "推荐内容"],
        ["/restaurants/1", "店铺菜单"],
        ["/publish/dish", "发布表单"],
        ["/users/21", "食友分享"],
      ]) {
        await p.goto(base + route);
        const handle = p.getByRole("button", {
          name: new RegExp(`(展开|收起)${label}$`),
        });
        await handle.waitFor();
        if (label === "发布表单")
          await p
            .getByRole("textbox", { name: "菜名", exact: true })
            .fill("拖动保留的草稿");
        const original = await handle.boundingBox();
        await drag(handle, -Math.min(300, original.y - 32));
        await settled(handle, true);
        const expanded = await handle.boundingBox();
        if (expanded.y > 45 || expanded.y >= original.y - 30)
          throw new Error(
            `${route} did not expand at ${width}px: ${JSON.stringify({ original, expanded })}`,
          );
        if (width === 390 && route === "/")
          await p.screenshot({
            path: "output/playwright/home-sheet-expanded.png",
          });
        await drag(handle, Math.min(320, original.y - expanded.y));
        await settled(handle, false);
        if (
          label === "发布表单" &&
          (await p
            .getByRole("textbox", { name: "菜名", exact: true })
            .inputValue()) !== "拖动保留的草稿"
        )
          throw new Error("Dragging reset the publish draft");
        if (
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          throw new Error(`${route} overflows at ${width}px`);
      }
      checks.push(
        `${width}px: home, photo home, restaurant menu, publishing form and public profile drag both ways`,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + "/");
    await p.getByRole("link", { name: /软件园.*晚饭/ }).click();
    const place = p.getByRole("dialog", { name: "地点和饭点", exact: true });
    await place.waitFor();
    let handle = place.getByRole("button", { name: "关闭面板", exact: true });
    await drag(handle, 90, true);
    await place.waitFor();
    await drag(handle, 240);
    await place.waitFor({ state: "detached" });
    if (!p.url().endsWith("#/"))
      throw new Error("Dismissing place picker navigated away");
    checks.push("Location picker drags closed; cancelled gesture stays open");

    await p.goto(base + "/foods/1");
    await p.getByRole("button", { name: "添加标签", exact: true }).click();
    const tags = p.getByRole("dialog", { name: /标签/ });
    await tags.waitFor();
    await drag(
      tags.getByRole("button", { name: "关闭面板", exact: true }),
      260,
    );
    await tags.waitFor({ state: "detached" });
    checks.push("Tag picker supports drag to close");

    await p.goto(base + "/settings");
    await p.getByRole("button", { name: "退出登录", exact: true }).click();
    const logout = p.getByRole("alertdialog", {
      name: "退出登录",
      exact: true,
    });
    await logout.waitFor();
    await drag(
      logout.getByRole("button", { name: "关闭退出确认", exact: true }),
      200,
    );
    await logout.waitFor({ state: "detached" });
    await p.getByRole("button", { name: "退出登录", exact: true }).waitFor();
    checks.push("Dragging logout confirmation cancels it without signing out");

    await p.goto(base + "/me");
    await p.getByRole("tab", { name: /评论/ }).click();
    const notice = p.getByRole("dialog", { name: "操作提示", exact: true });
    await notice.waitFor();
    await drag(
      notice.getByRole("button", { name: "关闭操作提示", exact: true }),
      200,
    );
    await notice.waitFor({ state: "detached" });
    await p.getByRole("link", { name: /粉丝$/ }).click();
    const people = p.getByRole("dialog", { name: "关注与粉丝", exact: true });
    await people.waitFor();
    await drag(people.locator(".mobile-sheet-handle"), 300);
    await people.waitFor({ state: "detached" });
    if (p.url().includes("people="))
      throw new Error("People dialog did not clean up its route");
    checks.push(
      "Notice and people dialogs drag closed and preserve the underlying profile",
    );
    await p.goto(base + "/");
    const quick = p.getByRole("button", { name: /推荐内容$/ });
    await quick.click();
    await p.waitForTimeout(50);
    await quick.click();
    await p.waitForTimeout(50);
    await quick.click();
    await settled(quick, true);
    if ((await quick.boundingBox()).y > 30)
      throw new Error("Rapid reversal changed the expanded position");
    await quick.click();
    await settled(quick, false);
    checks.push("Rapid reversals retain the original snap positions");
    await p.emulateMedia({ reducedMotion: "reduce" });
    const home = p.getByRole("button", { name: /推荐内容$/ });
    await home.focus();
    await p.keyboard.press("ArrowUp");
    await settled(home, true);
    await p.keyboard.press("Escape");
    await settled(home, false);
    checks.push("Keyboard controls and reduced motion");
    if (errors.length) throw new Error("Browser errors");
    return { checks, errors };
  } catch (error) {
    return {
      checks,
      errors,
      failure: String(error),
      url: p.url(),
      handles: await p
        .locator(".mobile-sheet-handle")
        .evaluateAll((nodes) =>
          nodes.map((e) => ({
            label: e.getAttribute("aria-label"),
            touch: getComputedStyle(e).touchAction,
            y: e.getBoundingClientRect().y,
            surface: e.parentElement.getAttribute("style"),
          })),
        ),
      snapshot: await p.locator("body").innerText(),
    };
  } finally {
    await context.close();
  }
}
