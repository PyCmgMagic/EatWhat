async function validateNotificationSoon(page) {
  const base = "http://127.0.0.1:5173";
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage(),
    errors = [],
    pushRequests = [],
    checks = [];
  p.setDefaultTimeout(10000);
  p.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1")
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-coming-soon",
          tokenValue: "isolated-placeholder-test",
        }),
      );
  });
  let flagOn = true;
  await context.route(
    (url) => url.origin !== base,
    (route) => route.abort(),
  );
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/push/")) {
        pushRequests.push(url.pathname);
        return route.fulfill({
          status: 500,
          json: { code: 50000, msg: "未捕获异常" },
        });
      }
      if (route.request().method() !== "GET") {
        errors.push("Unexpected write: " + url.pathname);
        return route.abort();
      }
      let data = [];
      if (url.pathname === "/api/user/info")
        data = {
          id: 10,
          displayName: "页面测试",
          verified: true,
          hasPassword: true,
          banned: false,
        };
      else if (url.pathname === "/api/remote-config")
        data = {
          configVersion: 1,
          flags: { push: { on: flagOn } },
          params: {},
          maintenance: { mode: "NONE" },
          versions: {},
          announcements: [],
        };
      else if (url.pathname === "/api/campus/list")
        data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
      else if (url.pathname === "/api/notification/unread/count") data = 0;
      else if (url.pathname.includes("notification"))
        data = { items: [], totalItems: 0, hasNext: false };
      return route.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const path = base + "/?demo=0#/settings/notifications";
  try {
    for (const [width, height] of [
      [320, 640],
      [390, 844],
      [520, 844],
      [1280, 900],
    ]) {
      await p.setViewportSize({ width, height });
      await p.goto(path);
      await p.getByRole("heading", { name: "敬请期待", exact: true }).waitFor();
      await p.locator(".notification-coming-soon img").evaluate(async (img) => {
        await img.decode();
      });
      const text = await p.locator("body").innerText();
      for (const unwanted of [
        "未捕获异常",
        "内容暂时未能加载",
        "重新加载",
        "登记此设备",
        "重要的操作，多一份安心。",
      ])
        assert(
          !text.includes(unwanted),
          "Obsolete error/device UI remains: " + unwanted,
        );
      assert(
        (await p.locator("h1").filter({ visible: true }).count()) === 1,
        "Duplicate page headings",
      );
      assert(
        !(await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )),
        "Horizontal overflow at " + width,
      );
      const action = p.getByRole("link", { name: "先去逛逛", exact: true });
      await action.scrollIntoViewIfNeeded();
      await action.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
      const bounds = await action.boundingBox();
      assert(bounds.height >= 44, "Small action target");
      if (width < 600) {
        const nav = await p
          .getByRole("navigation", { name: "主导航", exact: true })
          .boundingBox();
        assert(
          bounds.y + bounds.height <= nav.y,
          "Navigation covers the action at " + width,
        );
      }
      await p.screenshot({
        path: `output/playwright/notification-soon-${width}.png`,
        animations: "disabled",
        fullPage: true,
      });
      await action.click();
      await p.waitForURL(/#\/$/);
    }
    checks.push(
      "320/390/520px mobile and desktop show dish SVG, coming-soon message and a working discovery action without error/device controls",
    );
    flagOn = false;
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(path);
    await p.getByRole("heading", { name: "敬请期待", exact: true }).waitFor();
    await p.getByRole("link", { name: "返回设置", exact: true }).click();
    await p.waitForURL(/#\/settings$/);
    await p.getByRole("link", { name: /^通知/ }).click();
    await p.getByRole("heading", { name: "敬请期待", exact: true }).waitFor();
    assert(
      !pushRequests.length,
      "Unreleased push API was contacted: " + pushRequests.join(","),
    );
    checks.push(
      "Back navigation and settings entry work; neither enabled nor disabled remote flags trigger the unreleased push API",
    );
    await context.route("**/prototype/assets/dishes/yuntun.svg", (route) =>
      route.abort(),
    );
    await p.reload();
    await p
      .locator(".notification-coming-soon .dish-illustration > svg")
      .waitFor();
    await p.getByRole("heading", { name: "敬请期待", exact: true }).waitFor();
    checks.push(
      "The inline bowl SVG fallback keeps the page intact if the illustration asset fails",
    );
    assert(!errors.length, "Runtime errors: " + errors.join("; "));
    return { checks, errors, pushRequests, realBackendWrites: 0 };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/notification-soon-failure.png",
      animations: "disabled",
      fullPage: true,
    });
    throw error;
  } finally {
    await context.close();
  }
}
