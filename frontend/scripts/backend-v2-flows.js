async function verifyBackendV2(page) {
  const base = /^http:\/\/127\.0\.0\.1:\d+/.exec(page.url())?.[0] ?? "";
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("Use a local v2 development server.");
  const browser = page.context().browser();
  const errors = [];
  const realRequests = [];
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const open = (page, path, persona = "") =>
    page.goto(
      base + "/?demo=1" + (persona ? "&persona=" + persona : "") + "#" + path,
    );
  const button = (page, name) =>
    page.getByRole("button", { name, exact: true });
  const heading = (page, name) =>
    page.getByRole("heading", { name, exact: true });
  async function isolated(width, guest = false) {
    const context = await browser.newContext({
      viewport: { width, height: 920 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      const url = route.request().url();
      const path = url.slice(base.length).split("?")[0];
      if (url.startsWith(base + "/api/")) realRequests.push(path);
      return url.startsWith(base + "/") && !path.startsWith("/api/")
        ? route.continue()
        : route.abort();
    });
    if (guest)
      await context.addInitScript(() => {
        if (localStorage.getItem("eatwhat-v2-demo-session") === null)
          localStorage.setItem("eatwhat-v2-demo-session", "null");
      });
    const p = await context.newPage();
    p.on("pageerror", (error) => errors.push(error.message));
    p.on("dialog", (dialog) => void dialog.accept());
    return { context, p };
  }
  for (const width of [360, 390, 768, 1440]) {
    const { context, p } = await isolated(width, true);
    try {
      await open(p, "/");
      const wheel = p.getByRole("group", { name: "推荐转盘，左右滑动换店" });
      await wheel.waitFor();
      const layout = await p.evaluate(() => {
        const mobile = document.querySelector(".mobile-home-hero");
        const desktop = document.querySelector(".pc-hero");
        const sheet = document.querySelector(
          ".mobile-home-sheet, .pc-discovery-sheet",
        );
        const sceneTabs = document.querySelector(".v2-scene-tabs");
        const hero = mobile ?? desktop;
        const heading = hero?.querySelector("h1");
        const nav = document.querySelector(".mobile-main-navigation");
        return {
          mobileWidth: mobile?.getBoundingClientRect().width,
          desktop: !!desktop && !!document.querySelector(".pc-header nav"),
          hasSheet: !!sheet,
          sceneAboveRecommendation:
            !!sceneTabs &&
            !!heading &&
            sceneTabs.getBoundingClientRect().bottom <=
              heading.getBoundingClientRect().top,
          sceneOutsideResults: !sceneTabs?.closest(
            ".mobile-home-sheet, .pc-discovery-sheet",
          ),
          floatingNav: nav && getComputedStyle(nav).position === "fixed",
        };
      });
      assert(
        layout.hasSheet &&
          layout.sceneAboveRecommendation &&
          layout.sceneOutsideResults &&
          (width < 640
            ? layout.mobileWidth === width && layout.floatingNav
            : layout.desktop),
        "Original home layout missing at " + width,
      );
      if (width === 390 || width === 1440)
        await p.screenshot({
          path: "output/playwright/backend-v2-home-" + width + ".png",
        });
      const hero = p.getByRole("region", { name: "店铺推荐" });
      const original = await hero
        .getByRole("heading", { level: 1 })
        .innerText();
      await wheel.press("ArrowRight");
      assert(
        (await hero.getByRole("heading", { level: 1 }).innerText()) !==
          original,
        "Keyboard should change the local slot at " + width,
      );
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Horizontal overflow at " + width,
      );
      await button(p, "外卖").click();
      await wheel.waitFor();
      await button(p, "换一批").click();
      await wheel.waitFor();
      await button(p, "摇一摇").click();
      await p.getByRole("link", { name: "就它了" }).click();
      await heading(p, "食友评价").waitFor();
      await p.getByRole("link", { name: "登录后收藏" }).waitFor();
      await open(p, "/foods/1");
      await heading(p, "招牌牛肉面").waitFor();
      await open(p, "/topics");
      await heading(p, "该功能暂未开放").waitFor();
      if (width === 390) {
        await open(p, "/design");
        await heading(p, "移动端设计画板").waitFor();
        await p.getByRole("link", { name: "G2-Home", exact: true }).click();
        await p.locator('[data-screen="G2-Home"]').waitFor();
      }
      checks.push("访客推荐、转盘、菜品详情与旧链接 " + width);
    } finally {
      await context.close();
    }
  }

  const { context: accountContext, p: account } = await isolated(390, true);
  try {
    await open(account, "/auth");
    await account.getByLabel("手机号", { exact: true }).fill("13800000001");
    await button(account, "发送验证码").click();
    await account.getByText("演示验证码为 123456。").waitFor();
    await account.getByLabel("短信验证码").fill("000000");
    await account.getByLabel("我已阅读并同意以上两份文件").check();
    await button(account, "登录").click();
    await account
      .getByRole("alert")
      .filter({ hasText: "验证码不正确" })
      .waitFor();
    await account.getByLabel("短信验证码").fill("123456");
    await button(account, "登录").click();
    await heading(account, "小山").waitFor();
    await open(account, "/verify");
    await button(account, "学校统一认证").click();
    await button(account, "确认学校认证").click();
    await account.getByText("认证成功。").waitFor();

    await open(account, "/settings/phone");
    await heading(account, "换绑手机号").waitFor();
    await button(account, "向旧手机号发送验证码").click();
    await account.getByLabel("旧手机号验证码").fill("123456");
    await account.getByLabel("新手机号", { exact: true }).fill("13900000001");
    await button(account, "验证旧号码").click();
    await account.getByLabel("新手机号验证码").fill("123456");
    await button(account, "确认换绑").click();
    await button(account, "验证旧号码").waitFor();
    await open(account, "/restaurants/1");
    await heading(account, "一口面馆").waitFor();
    await button(account, "收藏店铺").click();
    await button(account, "取消收藏").waitFor();
    await button(account, "外卖").click();
    await button(account, "推荐").click();
    await button(account, "撤销评价").waitFor();
    await button(account, "撤销评价").click();
    await button(account, "撤销评价").waitFor({ state: "hidden" });
    await open(account, "/favorites");
    await account.getByRole("link", { name: /一口面馆/ }).waitFor();
    checks.push("手机验证码失败与成功、学校认证、换绑、外卖评价、店铺收藏 390");

    await open(account, "/restaurants/new");
    await heading(account, "添加店铺").waitFor();
    await account.getByLabel("店名", { exact: true }).fill("验收小馆");
    await account.getByLabel("地址", { exact: true }).fill("软件园东门");
    await account.getByLabel("GCJ-02 经度").fill("117.1345");
    await account.getByLabel("GCJ-02 纬度").fill("36.6674");
    await account
      .getByLabel("店铺封面")
      .setInputFiles("frontend/public/assets/noodles.jpg");
    await button(account, "发布店铺").click();
    await heading(account, "验收小馆").waitFor();
    assert(
      (await account.locator(".v2-shop-detail img").count()) === 1,
      "Uploaded cover was not displayed",
    );
    await account.getByRole("link", { name: "编辑店铺" }).click();
    await account.getByLabel("店名", { exact: true }).fill("验收小馆新版");
    await button(account, "保存店铺").click();
    await heading(account, "验收小馆新版").waitFor();
    await button(account, "恢复此版本").last().click();
    await heading(account, "验收小馆").waitFor();
    checks.push("店铺封面上传、发布、编辑与历史恢复 390");

    await open(account, "/admin");
    await account.getByText("需要管理员身份。").waitFor();
    checks.push("普通账号后台权限 390");
  } finally {
    await accountContext.close();
  }

  const { context: adminContext, p: admin } = await isolated(768);
  try {
    await open(admin, "/admin", "admin");
    await heading(admin, "数据概览").waitFor();
    await admin.getByRole("link", { name: "用户", exact: true }).click();
    await heading(admin, "用户管理").waitFor();
    await admin.getByLabel("关键词").fill("小山");
    await button(admin, "搜索").click();
    await button(admin, "封禁").click();
    await button(admin, "解封").waitFor();
    await button(admin, "解封").click();
    await button(admin, "重置密码").click();
    await admin.getByLabel("临时密码").fill("new-demo-123");
    await button(admin, "设置临时密码").click();
    await heading(admin, "给 小山 设置临时密码").waitFor({ state: "hidden" });

    await admin.getByRole("link", { name: "商圈", exact: true }).click();
    await button(admin, "添加商圈").click();
    await admin.getByLabel("商圈名称").fill("验收商圈");
    await admin.getByLabel("GCJ-02 经度").fill("117.134");
    await admin.getByLabel("GCJ-02 纬度").fill("36.667");
    await admin
      .getByLabel("GCJ-02 边界 GeoJSON")
      .fill('{"type":"Polygon","coordinates":[]}');
    await button(admin, "保存商圈").click();
    await admin
      .getByRole("alert")
      .filter({ hasText: "请输入有效的 GCJ-02" })
      .waitFor();
    await admin
      .getByLabel("GCJ-02 边界 GeoJSON")
      .fill(
        '{"type":"Polygon","coordinates":[[[117.13,36.66],[117.14,36.66],[117.14,36.67],[117.13,36.66]]]}',
      );
    await button(admin, "保存商圈").click();
    await admin.getByText("验收商圈", { exact: true }).waitFor();

    await admin.getByRole("link", { name: "政策", exact: true }).click();
    await button(admin, "发布新版本").click();
    await admin.getByLabel("版本号").fill("demo-2");
    await admin.getByLabel("隐私政策", { exact: true }).fill("新隐私政策");
    await admin.getByLabel("数据跨境说明", { exact: true }).fill("新跨境说明");
    await button(admin, "发布政策").click();
    await heading(admin, "政策已更新").waitFor();
    await admin.getByLabel("我已阅读并同意以上两份文件").check();
    await button(admin, "同意并继续").click();
    await heading(admin, "政策管理").waitFor();
    await admin.getByRole("link", { name: "版本 demo-2" }).click();
    await heading(admin, "版本 demo-2").waitFor();
    await admin.getByText("新隐私政策").waitFor();
    checks.push(
      "管理员封禁、解封、临时密码、商圈边界、发布政策、重同意后返回原页 768",
    );
  } finally {
    await adminContext.close();
  }

  const live = await browser.newContext({
    viewport: { width: 1440, height: 920 },
  });
  const p = await live.newPage();
  p.on("pageerror", (error) => errors.push(error.message));
  const apiCalls = [];
  const unexpectedApiCalls = [];
  const policy = {
    version: "v2-test",
    privacyText: "测试隐私",
    crossBorderText: "测试跨境",
  };
  const token = "v2-local-qa";
  const card = { id: 101, name: "接口测试店铺", gcjLng: 117.13, gcjLat: 36.66 };
  const second = { ...card, id: 102, name: "第二家接口店铺" };
  let agreed = false;
  let feeds = 0;
  let putAttempts = 0;
  let size = 0;
  let published;
  await live.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();
    if (!url.startsWith(base + "/")) return route.abort();
    if (url.startsWith(base + "/signed-test-image?")) {
      const headers = request.headers();
      assert(
        request.method() === "PUT" && !headers.satoken,
        "Storage PUT carried a session",
      );
      assert(
        headers["content-type"] === "image/jpeg" &&
          request.postDataBuffer()?.length === size,
        "Signed content type or length changed",
      );
      putAttempts++;
      return route.fulfill({ status: putAttempts === 1 ? 503 : 200, body: "" });
    }
    if (!url.startsWith(base + "/api/")) return route.continue();
    const auth = request.headers().satoken;
    const path = url.slice(base.length + 4).split("?")[0];
    const method = request.method();
    const body = request.postDataJSON();
    apiCalls.push(method + " " + path);
    const ok = (data = null, code = 0) =>
      route.fulfill({ json: { code, data } });
    if (path === "/campus/list")
      return ok([{ id: 1, name: "测试校区", isDefault: true }]);
    if (path === "/recommend") {
      feeds++;
      return ok({
        currentPage: 1,
        items: [card, second],
        hasNext: true,
        mealTime: "lunch",
      });
    }
    if (path === "/recommend/pick")
      return ok({ mealTime: "lunch", restaurant: second });
    if (path === "/recommend/tags")
      return ok({ categories: ["粉面"], tags: ["辣"], dislikableTags: ["辣"] });
    if (path === "/remote-config" && method === "GET") return ok({});
    if (path === "/telemetry/events" && method === "POST") return ok();
    if (path === "/auth/consent/policy") return ok(policy);
    if (path === "/auth/captcha/config") return ok({ enabled: false });
    if (path === "/auth/phone/code") {
      assert(
        method === "POST" && body.mobile === "13800000001" && !auth,
        "SMS request contract mismatch",
      );
      return ok();
    }
    if (path === "/auth/phone/login") {
      assert(
        body.device === "WEB" && body.policyVersion === policy.version && !auth,
        "Login policy contract mismatch",
      );
      return ok({ tokenName: "satoken", tokenValue: token });
    }
    if (path === "/user/info") {
      assert(auth === "Bearer " + token, "v2 bearer header missing");
      return agreed
        ? ok({
            id: 101,
            displayName: "测试账号",
            phone: "13800000001",
            verified: true,
          })
        : ok(null, 20009);
    }
    if (path === "/auth/consent/grant") {
      assert(
        auth === "Bearer " + token && body.policyVersion === policy.version,
        "Policy grant mismatch",
      );
      agreed = true;
      return ok({
        required: false,
        currentVersion: policy.version,
        agreedVersion: policy.version,
      });
    }
    if (path === "/auth/verify") return ok({ verified: true });
    if (path === "/auth/sdu/confirm") {
      assert(
        auth === "Bearer " + token && body.ticket === "isolated-sdu-ticket",
        "SSO confirmation mismatch",
      );
      return ok();
    }
    if (path === "/auth/verifyEmail") {
      assert(
        method === "POST" &&
          auth === "Bearer " + token &&
          body.token === "isolated-email-token",
        "Email confirmation mismatch",
      );
      return ok();
    }
    if (path === "/upload/presign") {
      assert(
        body.biz === "restaurants" &&
          body.contentType === "image/jpeg" &&
          body.fileSize > 0,
        "Presign payload mismatch",
      );
      size = body.fileSize;
      return ok({
        key: "restaurants/qa.jpg",
        putUrl: base + "/signed-test-image?X-Amz-Signature=isolated",
      });
    }
    if (path === "/upload/complete") {
      assert(
        putAttempts === 2 && body.key === "restaurants/qa.jpg",
        "Complete must follow successful PUT",
      );
      return ok({ key: body.key, url: "/assets/noodles.jpg" });
    }
    if (path === "/restaurant/add") {
      assert(
        body.picture === "restaurants/qa.jpg" &&
          body.gcjLng === 117.134 &&
          body.gcjLat === 36.667 &&
          body.kind === "food" &&
          body.hubId === undefined,
        "Shop creation payload mismatch",
      );
      published = { ...body, id: 103, pictureUrl: "/assets/noodles.jpg" };
      return ok({ id: 103 });
    }
    if (path === "/restaurant/detail/103") return ok(published);
    if (path === "/restaurant/103/history")
      return ok({ currentPage: 1, items: [], hasNext: false });
    if (path === "/foods/list" && method === "GET")
      return ok({ currentPage: 1, items: [], hasNext: false });
    unexpectedApiCalls.push(method + " " + path);
    return route.fulfill({
      status: 404,
      json: { code: 10004, msg: "Unexpected API path" },
    });
  });
  try {
    await p.goto(base + "/");
    const hero = p.getByRole("region", { name: "店铺推荐" });
    const heroTitle = (name) =>
      hero.getByRole("heading", { name, level: 1, exact: true });
    await heroTitle(card.name).waitFor();
    const initial = feeds;
    await button(p, "换一个").click();
    await heroTitle(second.name).waitFor();
    await p.evaluate(() => window.dispatchEvent(new Event("focus")));
    assert(feeds === initial, "Local rotation must not fetch another feed");
    await button(p, "换一批").click();
    await heroTitle(card.name).waitFor();
    assert(feeds === initial + 1, "Change batch should fetch exactly once");

    await p.goto(base + "/#/auth?next=/me");
    await p.getByLabel("手机号", { exact: true }).fill("13800000001");
    await button(p, "发送验证码").click();
    await p.getByText("验证码已发送。").waitFor();
    await p.getByLabel("短信验证码").fill("123456");
    await p.getByLabel("我已阅读并同意以上两份文件").check();
    await button(p, "登录").click();
    await heading(p, "政策已更新").waitFor();
    await p.getByLabel("我已阅读并同意以上两份文件").check();
    await button(p, "同意并继续").click();
    await heading(p, "测试账号").waitFor();
    await p.evaluate(() =>
      sessionStorage.setItem("eatwhat-v2-sso-owner", "202"),
    );
    await p.goto(
      base + "/home?result=success&code=0&ticket=isolated-sdu-ticket",
    );
    await button(p, "确认学校认证").waitFor();
    assert(
      !p.url().includes("ticket="),
      "SSO ticket was left in the address bar",
    );
    await button(p, "确认学校认证").click();
    await p
      .getByRole("alert")
      .filter({ hasText: "请切换回发起认证的账号" })
      .waitFor();
    assert(
      !apiCalls.includes("POST /auth/sdu/confirm"),
      "Wrong account attempted to use the SSO ticket",
    );
    await p.evaluate(() =>
      sessionStorage.setItem("eatwhat-v2-sso-owner", "101"),
    );
    await button(p, "确认学校认证").click();
    await p.getByText("认证成功。").waitFor();
    await p.goto(base + "/verify/email?token=isolated-email-token");
    await button(p, "确认学校邮箱").waitFor();
    assert(
      !p.url().includes("token="),
      "Email token was left in the address bar",
    );
    await button(p, "确认学校邮箱").click();
    await p.getByText("认证成功。").waitFor();
    await p.goto(base + "/#/restaurants/new");
    await heading(p, "添加店铺").waitFor();
    await p.getByLabel("店名", { exact: true }).fill("签名上传验收");
    await p.getByLabel("地址", { exact: true }).fill("软件园南门");
    await p.getByLabel("GCJ-02 经度").fill("117.134");
    await p.getByLabel("GCJ-02 纬度").fill("36.667");
    await p
      .getByLabel("店铺封面")
      .setInputFiles("frontend/public/assets/noodles.jpg");
    await button(p, "发布店铺").click();
    await p.getByRole("alert").filter({ hasText: "上传失败" }).waitFor();
    assert(
      !apiCalls.includes("POST /upload/complete"),
      "Failed storage PUT must not complete upload",
    );
    await button(p, "发布店铺").click();
    await heading(p, "签名上传验收").waitFor();
    assert(
      unexpectedApiCalls.length === 0,
      "Unexpected API calls: " + unexpectedApiCalls.join(", "),
    );
    checks.push(
      "正式模式请求拦截、推荐请求次数、v2 登录与重同意、认证票据清理、签名上传失败和重试 1440",
    );
  } finally {
    await live.close();
  }

  assert(
    realRequests.length === 0,
    "Demo made a real API request: " + realRequests.join(", "),
  );
  assert(errors.length === 0, "Browser errors: " + errors.join(", "));
  return {
    checks,
    demoNetworkRequests: realRequests.length,
    liveApiCalls: apiCalls,
  };
}
