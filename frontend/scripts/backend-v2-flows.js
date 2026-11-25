async function verifyBackendV2(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("Use a local development server.");
  const browser = page.context().browser();
  const checks = [], errors = [], blockedDemoRequests = [], apiCalls = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const button = (root, name) => root.getByRole("button", { name, exact: true });
  const heading = (root, name) => root.getByRole("heading", { name, exact: true });
  const demo = (p, path, persona) =>
    p.goto(base + "/?demo=1" + (persona ? "&persona=" + persona : "") + "#" + path);

  async function scenario(width, height, run, api) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
      colorScheme: width === 320 || width === 820 ? "dark" : "light",
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (api) return api(route, url);
      if (!url.pathname.startsWith("/api/")) return route.continue();
      blockedDemoRequests.push(url.pathname);
      return route.abort();
    });
    const p = await context.newPage();
    p.setDefaultTimeout(8000);
    p.on("pageerror", (error) => errors.push(error.message));
    try {
      await run(p);
    } catch (error) {
      throw new Error(width + "px " + new URL(p.url()).hash + " — " + error.message, { cause: error });
    } finally {
      await context.close();
    }
  }

  for (const width of [320, 390, 820, 1440]) {
    await scenario(width, width === 320 ? 568 : 900, async (p) => {
      await demo(p, "/");
      const hero = p.locator(width < 640 ? ".mobile-home-hero" : ".pc-hero");
      const title = hero.locator("h1");
      const first = await title.textContent();
      await button(hero, "换一个").click();
      await p.waitForFunction(({ selector, first }) => {
        const next = document.querySelector(selector)?.textContent;
        return next && next !== first;
      }, { selector: width < 640 ? ".mobile-home-hero h1" : ".pc-hero h1", first });
      const tabs = p.getByRole("tablist", { name: "店铺分类" });
      await tabs.getByRole("tab", { name: "美食" }).waitFor();
      assert(await p.getByRole("main").count() === 1, "The discovery page needs one main landmark");
      if (width === 320) {
        for (const control of [
          tabs.getByRole("tab", { name: "美食" }),
          p.getByRole("combobox", { name: "推荐店铺排序" }),
        ]) {
          await control.waitFor();
          assert(await control.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
          }), "Bottom navigation covers a discovery control");
        }
      }

      await p.getByRole("radio", { name: "外卖", exact: true }).click();
      assert(await p.getByRole("radio", { name: "外卖", exact: true }).getAttribute("aria-checked") === "true", "Delivery scene did not switch");
      await demo(p, "/foods/1");
      await heading(p, "鲜虾蟹籽云吞").waitFor();
      assert(await p.getByRole("main").count() === 1, "Dish detail needs one main landmark");
      await demo(p, "/restaurants/1");
      await heading(p, "袁记云饺").waitFor();
      await demo(p, "/settings");
      await p.getByRole("main").waitFor();
      await demo(p, "/auth/username-register?next=%2Fme");
      await p.waitForURL("**#/auth/register?next=%2Fme");
      await p.getByRole("textbox", { name: "登录手机号" }).waitFor();
      checks.push(width + "px recommendation rotation, scenes, details, settings and legacy registration");
    });
  }

  await scenario(1440, 900, async (p) => {
    const keyword = "一食堂";
    const encoded = encodeURIComponent(keyword);
    for (const suffix of ["", "&type=shop"]) {
      await demo(p, "/search?q=" + encoded + suffix);
      const desktopSearch = p.getByRole("combobox", { name: "搜索菜品或店名" });
      await desktopSearch.fill(keyword);
      await desktopSearch.press("Enter");
      await p.waitForURL("**#/search?q=" + encoded + suffix);
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await demo(p, "/");
    const entry = button(p, "搜索菜品或店名");
    const dialog = p.getByRole("dialog", { name: "搜索", exact: true });
    const input = dialog.getByRole("searchbox");
    const show = async () => {
      await entry.click();
      await input.waitFor();
      await p.waitForFunction(() => document.activeElement?.matches(".ew-home-search input"));
      assert(await dialog.evaluate((el) => el.matches("dialog:modal")), "Search must use a native modal");
      assert(await p.evaluate(() => document.documentElement.style.overflow === "hidden"), "Search did not lock scrolling");
    };
    await show();
    await button(dialog, keyword + " 店铺").waitFor();
    await button(dialog, keyword + " 菜品").waitFor();
    for (let step = 0; step < 10; step++) {
      await p.keyboard.press("Tab");
      assert(await dialog.evaluate((el) => document.activeElement === document.body || el.contains(document.activeElement)), "Search focus escaped into the page");
    }
    await p.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert(await entry.evaluate((el) => el === document.activeElement), "Search did not restore toolbar focus");
    assert(await p.evaluate(() => document.documentElement.style.overflow !== "hidden"), "Search left scrolling locked");
    await show();
    await button(dialog, "关闭搜索").click();
    await dialog.waitFor({ state: "detached" });
    await show();
    await p.mouse.click(5, 350);
    await dialog.waitFor({ state: "detached" });
    await show();
    await button(dialog, keyword + " 店铺").click();
    await p.waitForURL("**#/search?q=" + encoded + "&type=shop");
    await demo(p, "/");
    await show();
    await dialog.getByRole("button", { name: "删除店铺搜索记录“一食堂”", exact: true }).click();
    assert(!await button(dialog, keyword + " 店铺").count(), "Removed shop history is still present");
    await button(dialog, keyword + " 菜品").click();
    await p.waitForURL("**#/search?q=" + encoded);
    checks.push("Desktop and mobile share typed search history; mobile search traps and restores focus");
  });

  await scenario(320, 568, async (p) => {
    await demo(p, "/restaurants/new");
    await button(p, "搜不到？手动添加").click();
    const name = p.getByRole("textbox", { name: "店名", exact: true });
    await name.fill("验收小馆");
    await p.getByRole("textbox", { name: "详细地址" }).fill("软件园南门");
    const portrait = await p.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 180;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#855b55";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL().split(",")[1];
    });
    await p.locator(".shop-photo-field input[type=file]").setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: Buffer.from(portrait, "base64"),
    });
    await button(p, "编辑照片").click();
    const editor = p.getByRole("dialog", { name: "编辑门头照片" });
    const frame = editor.locator(".shop-photo-edit-orientation");
    const left = editor.locator('[data-corner="top-left"]');
    await left.waitFor();
    assert(await editor.locator(".shop-photo-crop-handle").evaluateAll((handles) =>
      handles.length === 4 && handles.every((handle) => {
        const rect = handle.getBoundingClientRect();
        return rect.width >= 43 && rect.height >= 43 &&
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === handle;
      })
    ), "Narrow storefront photo needs four independently reachable crop handles");
    await left.focus();
    await p.keyboard.press("ArrowRight");
    const cropStart = (axis) => frame.evaluate((el, axis) => parseFloat(el.style.getPropertyValue("--crop-" + axis)), axis);
    assert(await cropStart("left") > 0, "A narrow portrait cannot be cropped horizontally");
    await p.keyboard.press("ArrowDown");
    assert(await cropStart("top") > 0, "The portrait cannot be cropped vertically");
    for (let step = 0; step < 10; step++) await left.press("Shift+ArrowDown");
    const move = editor.locator(".shop-photo-crop-move");
    const grab = await move.boundingBox();
    const x = grab.x + grab.width / 2, y = grab.y + grab.height / 2;
    assert(await move.evaluate((el, [x, y]) => document.elementFromPoint(x, y) === el, [x, y]), "The corners cover the small crop's move target");
    const oldTop = await cropStart("top");
    await p.mouse.move(x, y);
    await p.mouse.down();
    await p.mouse.move(x, y - 16);
    await p.mouse.up();
    assert(await cropStart("top") < oldTop, "A small crop cannot be dragged");
    await button(editor, "还原原图").click();
    await left.press("ArrowRight");
    await left.press("ArrowDown");
    await button(editor, "顺时针旋转 90 度").click();
    const before = await cropStart("top");
    await left.focus();
    await p.keyboard.press("ArrowDown");
    assert(await cropStart("top") > before, "The rotated short edge cannot be cropped vertically");
    await button(editor, "保存修改").click();
    await editor.waitFor({ state: "detached" });
    await p.waitForFunction(() => {
      const preview = document.querySelector(".shop-photo-preview img");
      return preview && preview.naturalWidth > 180 && preview.naturalWidth > preview.naturalHeight;
    });
    assert(await name.inputValue() === "验收小馆", "The photo editor changed the shop name");
    await demo(p, "/foods/1");
    const rating = p.locator(".food-rating-entry");
    await rating.click();
    const score = p.getByRole("dialog", { name: "给这道菜评分" });
    await button(score, "打 4 分").click();
    await score.getByText(/已评 4 分/).waitFor();
    await button(score, "打 4 分").click();
    await score.getByText("已撤销评分").waitFor();
    await p.keyboard.press("Escape");
    await score.waitFor({ state: "detached" });
    assert(await rating.evaluate((el) => el === document.activeElement), "Closing a shared rating modal lost focus");
    checks.push("Small-phone storefront crop and rotation, rating save and undo, shared modal focus");
  });

  await scenario(820, 900, async (p) => {
    await demo(p, "/admin");
    await heading(p, "需要管理员身份").waitFor();
    await demo(p, "/admin", "admin");
    await heading(p, "数据概览").waitFor();
    await button(p, "打开管理菜单").click();
    await p.getByRole("link", { name: "用户管理", exact: true }).click();
    await heading(p, "用户管理").waitFor();
    await p.getByRole("link", { name: "切换到前台" }).click();
    await p.waitForURL((url) => !url.hash.startsWith("#/admin"));
    checks.push("Admin access and front-office switching");
  });

  const phone = "13800000001";
  const token = "isolated-v2-qa";
  let signedIn = false;
  let feeds = 0;
  let signedSize = 0;
  let putAttempts = 0;
  let completedUpload = false;
  let shop;
  let restored = false;
  const shopId = 103;
  const shopName = "签名上传验收";
  const editedName = "验收店铺新版";
  const imageKey = "restaurants/qa.jpg";
  const place = { id: "poi-test", name: shopName, address: "软件园南门", point: { gcjLng: 117.134, gcjLat: 36.667 } };
  const firstShop = { id: 101, name: "接口测试店铺", signatureFoods: [{ id: 201, name: "推荐第一道", price: 10 }] };
  const secondShop = { id: 102, name: "第二家接口店铺", signatureFoods: [{ id: 202, name: "推荐第二道", price: 12 }] };
  await scenario(1440, 920, async (p) => {
    await p.goto(base + "/?demo=0#/");
    const hero = p.locator(".pc-hero");
    await heading(hero, "推荐第一道").waitFor();
    const before = feeds;
    await button(hero, "换一个").click();
    await heading(hero, "推荐第二道").waitFor();
    assert(feeds === before, "Local rotation fetched another batch");
    await button(p, "换一批推荐").click();
    await p.waitForFunction(() => document.querySelector(".pc-hero h1")?.textContent === "新一批推荐");
    assert(feeds === before + 1, "Refreshing recommendations must fetch exactly once");

    await p.goto(base + "/?demo=0#/auth/register?next=%2Fme");
    await p.getByRole("textbox", { name: "登录手机号" }).fill(phone);
    await button(p, "获取验证码").click();
    await p.getByRole("button", { name: /s 后重发/ }).waitFor();
    const code = p.getByRole("textbox", { name: "登录验证码" });
    await code.fill("000000");
    await button(p, "登录 / 注册").click();
    await p.getByText("测试验证码错误，请重新输入。", { exact: true }).waitFor();
    assert(!signedIn, "Rejected SMS code started an authenticated session");
    await code.fill("123456");
    await button(p, "登录 / 注册").click();
    await p.waitForURL("**#/me");
    await heading(p, "测试账号").waitFor();
    assert(signedIn && apiCalls.includes("GET /api/user/info"), "The SMS session did not load the profile");
    checks.push("Mocked v2 network: recommendation batching, SMS login and authenticated profile");

    await p.goto(base + "/?demo=0#/restaurants/new");
    await p.getByRole("searchbox", { name: "搜索店名或地址" }).fill(shopName);
    await p.getByRole("button", { name: new RegExp(shopName) }).click();
    const jpeg = await p.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 180;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#855b55";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg").split(",")[1];
    });
    await p.locator(".shop-photo-field input[type=file]").setInputFiles({
      name: "storefront.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(jpeg, "base64"),
    });
    const preview = p.locator(".shop-photo-field").getByRole("img", { name: "门头照片预览" });
    await preview.waitFor();
    const submit = button(p, "提交新店");
    await submit.click();
    await p.getByRole("alert").filter({ hasText: "图片上传失败（HTTP 503）" }).waitFor();
    assert(putAttempts === 1 && !completedUpload && !shop, "A failed PUT completed or published the upload");
    await preview.waitFor();
    await submit.click();
    await p.waitForURL("**#/publish/dish");
    assert(putAttempts === 2 && completedUpload && shop?.name === shopName, "Retry did not publish the original draft");

    await p.goto(base + "/?demo=0#/restaurants/" + shopId + "/edit");
    await p.getByRole("textbox", { name: "店名", exact: true }).fill(editedName);
    await button(p, "保存修改").click();
    await heading(p, editedName).waitFor();
    await p.goto(base + "/?demo=0#/restaurants/" + shopId + "/history");
    await button(p, "恢复到这个版本").click();
    await button(p, "确认恢复").click();
    await p.getByText("已恢复到这个版本。", { exact: true }).waitFor();
    assert(restored && shop.name === shopName, "The original shop revision was not restored");
    checks.push("Mocked v2 storefront: signed PUT failure and retry, publish, edit and history restore");
  }, async (route, url) => {
    const request = route.request();
    const path = url.pathname;
    const method = request.method();
    const auth = request.headers()["x-v2-test"];
    const ok = (data = null) => route.fulfill({ json: { code: 0, data } });
    if (path === "/src/api/baidu-places.ts")
      return route.fulfill({ contentType: "application/javascript", body: "export const searchMapPlaces = async () => " + JSON.stringify([place]) });
    if (path === "/signed-test-image") {
      assert(method === "PUT" && !auth, "Signed storage PUT carried an app session");
      assert(request.headers()["content-type"] === "image/jpeg" && request.postDataBuffer()?.length === signedSize, "Signed storage PUT changed the declared content");
      return route.fulfill({ status: ++putAttempts === 1 ? 503 : 200, body: "" });
    }
    if (!path.startsWith("/api/")) return route.continue();
    apiCalls.push(method + " " + path);
    if (path === "/api/recommend") {
      assert(method === "GET" && !auth, "Guest recommendations sent an unexpected request");
      feeds++;
      const items = feeds === 1 ? [firstShop, secondShop] : [{
        ...firstShop,
        signatureFoods: [{ id: 203, name: "新一批推荐", price: 14 }],
      }];
      return ok({ items, currentPage: 1, hasNext: true, mealTime: "lunch" });
    }
    if (path === "/api/campus/list")
      return ok([{ id: 1, name: "测试校区", isDefault: true }]);
    if (path === "/api/remote-config")
      return ok({ flags: {}, params: {}, maintenance: { mode: "NONE" } });
    if (path === "/api/auth/captcha/config") return ok({ enabled: false });
    if (path === "/api/auth/phone/code") {
      assert(method === "POST" && !auth && request.postDataJSON().mobile === phone, "SMS request contract mismatch");
      return ok();
    }
    if (path === "/api/auth/phone/login") {
      const body = request.postDataJSON();
      assert(method === "POST" && !auth && body.mobile === phone && body.device === "WEB", "SMS login payload mismatch");
      if (body.code === "000000")
        return route.fulfill({ json: { code: 30005, msg: "测试验证码错误，请重新输入。" } });
      assert(body.code === "123456", "SMS login lost the entered code");
      signedIn = true;
      return ok({ isLogin: true, newUser: false, tokenName: "x-v2-test", tokenValue: token });
    }
    if (path === "/api/user/info") {
      assert(auth === "Bearer " + token, "Authenticated request is missing the dynamic token header");
      return ok({ id: 101, displayName: "测试账号", phone, verified: true, role: "user" });
    }
    if (path === "/api/upload/presign") {
      const body = request.postDataJSON();
      assert(method === "POST" && auth === "Bearer " + token && body.biz === "restaurants" && body.contentType === "image/jpeg" && body.fileSize > 0, "Storefront upload presign contract mismatch");
      signedSize = body.fileSize;
      return ok({ key: imageKey, putUrl: base + "/signed-test-image?X-Amz-Signature=isolated" });
    }
    if (path === "/api/upload/complete") {
      assert(method === "POST" && putAttempts === 2 && request.postDataJSON().key === imageKey, "Image completion must follow a successful PUT");
      completedUpload = true;
      return ok({ key: imageKey, url: "/assets/restaurants/campus-storefront.webp" });
    }
    if (path === "/api/restaurant/add") {
      const body = request.postDataJSON();
      assert(method === "POST" && completedUpload && body.picture === imageKey && body.name === shopName && body.address === place.address && body.gcjLng === place.point.gcjLng && body.gcjLat === place.point.gcjLat, "Storefront creation lost its photo or selected position");
      shop = { ...body, id: shopId, pictureUrl: "/assets/restaurants/campus-storefront.webp" };
      return ok({ id: shopId });
    }
    if (path === "/api/restaurant/detail/" + shopId) return ok(shop);
    if (path === "/api/restaurant/edit/" + shopId) {
      const body = request.postDataJSON();
      assert(method === "PUT" && body.name === editedName, "Shop edit payload mismatch");
      shop = { ...shop, name: body.name };
      return ok({ id: shopId });
    }
    if (path === "/api/restaurant/" + shopId + "/history")
      return ok({ items: [{ id: 702, action: "update" }, { id: 701, action: "create" }], hasNext: false });
    if (path === "/api/restaurant/" + shopId + "/history/701/restore") {
      assert(method === "POST", "Shop history restore used the wrong method");
      restored = true;
      shop = { ...shop, name: shopName };
      return ok({ id: shopId, revisionId: 702 });
    }
    if (path === "/api/user/activity" || path === "/api/device/register" || path === "/api/telemetry/events") return ok();
    assert(method === "GET", "Unexpected write: " + method + " " + path);
    return ok({ items: [], totalItems: 0, hasNext: false });
  });

  assert(checks.length === 9, "A v2 browser scenario was skipped");
  assert(errors.length === 0 && blockedDemoRequests.length === 0, JSON.stringify({ errors, blockedDemoRequests }));
  return { checks, realBackendRequests: 0, interceptedApiCalls: apiCalls };
}
