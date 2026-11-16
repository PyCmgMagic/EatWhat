async function verifyPublishPending(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("请在本地开发页面运行");
  const checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  for (const width of [390, 320, 520, 1440]) {
    const mobile = width < 640;
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
    const p = await context.newPage();
    p.setDefaultTimeout(7000);
    p.on("pageerror", (error) => errors.push(error.message));
    let releaseUpload, releaseCreate, markUpload, markCreate;
    const uploadGate = new Promise((resolve) => {
      releaseUpload = resolve;
    });
    const createGate = new Promise((resolve) => {
      releaseCreate = resolve;
    });
    const uploading = new Promise((resolve) => {
      markUpload = resolve;
    });
    const creating = new Promise((resolve) => {
      markCreate = resolve;
    });
    let uploads = 0,
      creates = 0,
      failCreate = true;
    await context.addInitScript(() => {
      if (location.hostname === "127.0.0.1")
        localStorage.setItem(
          "eatwhat-session",
          JSON.stringify({
            tokenName: "x-review",
            tokenValue: "isolated-publish-pending",
          }),
        );
    });
    await context.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname;
      if (url.origin !== base) return route.abort();
      if (path === "/mock-publish-storage") {
        uploads++;
        markUpload();
        await uploadGate;
        return route.fulfill({ status: 200, body: "" });
      }
      if (!path.startsWith("/api/")) return route.continue();
      const shop = { id: 7, name: "等待状态测试餐厅", address: "软件园" };
      let data = [];
      if (path === "/api/user/info")
        data = {
          id: 21,
          displayName: "发布测试",
          verified: true,
          banned: false,
        };
      else if (
        ["/api/restaurant/browse", "/api/restaurant/search"].includes(path)
      )
        data = { items: [shop], hasNext: false, totalItems: 1 };
      else if (path.startsWith("/api/restaurant/detail/")) data = shop;
      else if (path === "/api/remote-config")
        data = {
          configVersion: 1,
          flags: {},
          params: {},
          maintenance: { mode: "NONE" },
          announcements: [],
          versions: {},
        };
      else if (path === "/api/campus/list")
        data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
      else if (path === "/api/notification/unread/count") data = 0;
      else if (path === "/api/device/register") data = {};
      else if (path === "/api/upload/presign")
        data = {
          key: "foods/pending-test.png",
          putUrl: base + "/mock-publish-storage",
        };
      else if (path === "/api/upload/complete")
        data = { key: "foods/pending-test.png" };
      else if (path === "/api/foods/upload") {
        creates++;
        markCreate();
        await createGate;
        if (failCreate)
          return route.fulfill({
            status: 422,
            json: { code: 40000, msg: "发布失败，请重试" },
          });
        data = { id: 71 };
      } else if (path === "/api/foods/detail/71")
        data = {
          id: 71,
          restaurantId: 7,
          name: "等待状态测试菜",
          pictureUrl: [],
          category: "staple",
        };
      else if (request.method() !== "GET")
        throw new Error("未预期的写请求：" + path);
      return route.fulfill({ json: { code: 0, data } });
    });
    try {
      await p.goto(
        `${base}/?demo=0&view=${mobile ? "mobile" : "desktop"}#/publish`,
      );
      await p.getByRole("radio", { name: /等待状态测试餐厅/ }).click();
      if (mobile)
        await p
          .getByRole("link", {
            name: "下一步：给等待状态测试餐厅加菜",
            exact: true,
          })
          .click();
      await p
        .getByRole("textbox", { name: "菜名", exact: true })
        .fill("等待状态测试菜");
      const photo = await p.request.get(
        base + "/prototype/assets/photos/sq_luosi.png",
      );
      const file = {
        name: "pending.png",
        mimeType: "image/png",
        buffer: await photo.body(),
      };
      if (mobile) {
        const chooser = p.waitForEvent("filechooser");
        await p
          .getByRole("button", { name: "再加一张照片", exact: true })
          .click();
        await (await chooser).setFiles(file);
        await p.waitForURL("**#/publish/crop");
        await p.getByRole("link", { name: "完成", exact: true }).click();
        await p.waitForURL("**#/publish/dish");
      } else await p.locator("input[type=file]").setInputFiles(file);
      const submit = mobile
        ? p
            .getByRole("link", { name: "发布", exact: true })
            .or(p.getByRole("button", { name: "发布", exact: true }))
        : p.getByRole("button", { name: "发布这道菜", exact: true });
      await submit.click();
      await uploading;
      const pending = p.getByRole("button", { name: /正在上传照片/ });
      await pending.waitFor({ timeout: 2000 });
      assert(!(await pending.isEnabled()), `${width}px 上传中未禁用发布`);
      assert(
        (await pending.getAttribute("aria-busy")) === "true",
        `${width}px 缺少等待状态`,
      );
      if (mobile)
        assert(
          await pending.evaluate((button) => {
            const parent = button.parentElement;
            const style = getComputedStyle(parent);
            const contentWidth =
              parent.clientWidth -
              parseFloat(style.paddingLeft) -
              parseFloat(style.paddingRight);
            return Math.abs(button.offsetWidth - contentWidth) <= 1;
          }),
          `${width}px 发布按钮未填满底栏`,
        );
      await pending.evaluate((button) => {
        button.click();
        button.click();
      });
      assert(uploads === 1 && creates === 0, `${width}px 上传阶段重复提交`);
      if (width === 390)
        await p.screenshot({
          path: "output/playwright/publish-upload-pending.png",
        });
      releaseUpload();
      await creating;
      const sending = p.getByRole("button", { name: "正在发布…", exact: true });
      await sending.waitFor();
      assert(!(await sending.isEnabled()), `${width}px 提交中未禁用发布`);
      assert(
        (await sending.getAttribute("aria-busy")) === "true",
        `${width}px 提交中缺少等待状态`,
      );
      await sending.evaluate((button) => {
        button.click();
        button.click();
      });
      assert(creates === 1, `${width}px 重复提交菜品`);
      assert(
        !(await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )),
        `${width}px 页面横向溢出`,
      );
      if (width === 390)
        await p.screenshot({
          path: "output/playwright/publish-create-pending.png",
        });
      releaseCreate();
      await p.getByText("发布失败，请重试", { exact: true }).waitFor();
      const retry = p.getByRole("button", {
        name: mobile ? "发布" : "发布这道菜",
        exact: true,
      });
      await retry.waitFor();
      assert(await retry.isEnabled(), `${width}px 失败后无法重试`);
      assert(
        (await p
          .getByRole("textbox", { name: "菜名", exact: true })
          .inputValue()) === "等待状态测试菜",
        `${width}px 失败丢失草稿`,
      );
      failCreate = false;
      await retry.click();
      await p.waitForURL("**#/foods/71");
      assert(
        uploads === 1 && creates === 2,
        `${width}px 重试重复上传或发布次数不正确`,
      );
      checks.push(
        `${width}px: 上传等待、发布等待、防重复提交、失败恢复、保留草稿、成功跳转`,
      );
    } finally {
      releaseUpload();
      releaseCreate();
      await context.close();
    }
  }
  assert(errors.length === 0, errors.join("\n"));
  return { checks, errors, realBackendRequests: 0 };
}
