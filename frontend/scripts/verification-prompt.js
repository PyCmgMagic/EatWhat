async function validateVerificationPrompt(page) {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
    });
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  const checks = [],
    errors = [],
    writes = [];
  let verified = false;
  let rejectFavorite = false;
  const food = {
    id: 71,
    name: "招牌牛筋面",
    restaurantId: 9,
    restaurantName: "渔见17码头",
    price: 18.9,
    category: "staple",
    stageColor: "soy",
    description: "免费加面，吃得很爽。",
    uploaderName: "rpc",
    accountId: 21,
    createdAt: Date.now() - 9 * 3600000,
    pictureUrl: ["/prototype/assets/photos/sq_luosi.png"],
    systemTags: [],
    myCustomTags: [],
    likesCount: 1,
    isLiked: false,
    isFavorite: false,
  };
  p.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1")
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-session",
          tokenValue: "isolated-verification-test",
        }),
      );
  });
  await context.route(
    (u) => u.origin !== "http://127.0.0.1:5173",
    (r) => r.abort(),
  );
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    (r) => {
      const path = new URL(r.request().url()).pathname;
      if (r.request().method() !== "GET") writes.push(path);
      let data = [];
      if (path === "/api/user/info")
        data = {
          id: 10,
          displayName: "测试同学",
          userName: "test",
          verified,
          banned: false,
          role: "user",
        };
      else if (path === "/api/foods/detail/71") data = food;
      else if (path === "/api/restaurant/detail/9")
        data = { id: 9, name: "渔见17码头", address: "CCPARK济高云泉中心" };
      else if (path === "/api/foods/71/like") {
        food.isLiked = true;
        food.likesCount = 2;
        data = null;
      } else if (
        path === "/api/foods/71/favorite" ||
        path === "/api/foods/71/unfavorite"
      ) {
        if (rejectFavorite)
          return r.fulfill({
            status: 403,
            json: { code: 20004, msg: "权限不足：用户未验证" },
          });
        food.isFavorite = path.endsWith("/favorite");
        data = null;
      } else if (path === "/api/campus/list")
        data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
      else if (path.includes("/tags"))
        data = { systemTags: [], myCustomTags: [] };
      else if (path === "/api/remote-config")
        data = {
          configVersion: 1,
          flags: {},
          params: {},
          maintenance: { mode: "NONE" },
          announcements: [],
          versions: {},
        };
      else if (path === "/api/notification/unread/count") data = 0;
      return r.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const base = "http://127.0.0.1:5173/?demo=0#";
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const dialog = p.locator(".ew-verification-dialog");
  const settled = async () => {
    await p.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    });
    await dialog.evaluate(async (el) => {
      await Promise.allSettled(
        el.getAnimations({ subtree: true }).map((a) => a.finished),
      );
    });
  };
  try {
    for (const width of [320, 390, 520, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      await p.goto(base + "/foods/71");
      const like = p.locator(
        width < 768 ? ".dish-like" : ".pc-dish-actions > button",
      );
      await like.waitFor();
      await like.click();
      await dialog.waitFor();
      await settled();
      assert(
        p.url() === base + "/foods/71",
        "Like changed route before consent",
      );
      assert(!writes.length, "Unverified like sent an API mutation");
      const box = await dialog.boundingBox();
      assert(
        box &&
          box.height < 400 &&
          box.x >= 16 &&
          box.x + box.width <= width - 16 &&
          Math.abs(box.y + box.height / 2 - 422) < 2,
        `Dialog not compact and centered at ${width}px: ${JSON.stringify(box)}`,
      );
      const go = await dialog
        .getByRole("button", { name: "去认证", exact: true })
        .boundingBox();
      assert(
        go &&
          go.height >= 44 &&
          go.x >= box.x &&
          go.x + go.width <= box.x + box.width,
        "Dialog action clipped",
      );
      if (width === 390 || width === 1280)
        await p.screenshot({
          path: `output/playwright/verification-prompt-${width}.png`,
        });
      await dialog.getByRole("button", { name: "暂不", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      assert(p.url() === base + "/foods/71", "Cancel changed route");
      assert(
        await like.evaluate((el) => document.activeElement === el),
        "Cancel did not restore focus",
      );
      await like.click();
      await dialog.waitFor();
      await p.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert(p.url() === base + "/foods/71", "Escape changed route");
      const favorite = p.getByRole("button", { name: "收藏", exact: true });
      await favorite.click();
      await dialog.waitFor();
      await settled();
      assert(
        p.url() === base + "/foods/71" && !writes.length,
        "Unverified favorite bypassed the prompt",
      );
      assert(
        (await dialog.innerText()).includes("收藏"),
        "Prompt did not explain favorite access",
      );
      if (width === 390)
        await p.screenshot({
          path: "output/playwright/favorite-verification-390.png",
        });
      await dialog.getByRole("button", { name: "暂不", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      assert(
        await favorite.evaluate((el) => document.activeElement === el),
        "Favorite cancel lost focus",
      );
      await favorite.click();
      await dialog.getByRole("button", { name: "去认证", exact: true }).click();
      await p.waitForURL(base + "/verify?next=%2Ffoods%2F71");
      await p.getByRole("link", { name: "返回原页面", exact: true }).click();
      await favorite.waitFor();
      const tags =
        width < 768
          ? p.locator(".dish-add-taste")
          : p.getByRole("button", { name: "+ 加标签", exact: true });
      await tags.click();
      await dialog.waitFor();
      assert(
        p.url() === base + "/foods/71" && !writes.length,
        "Tags bypassed the prompt",
      );
      await dialog.getByRole("button", { name: "去认证", exact: true }).click();
      await p.waitForURL(base + "/verify?next=%2Ffoods%2F71");
      const back = p.getByRole("link", { name: "返回原页面", exact: true });
      await back.waitFor();
      await back.click();
      await like.waitFor();
      assert(p.url() === base + "/foods/71", "Verification return lost origin");
      checks.push(
        `${width}px: compact prompt, cancel/focus/Escape, favorite + like + tags gated, explicit navigation + return`,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + "/restaurants/9");
    await p.getByRole("button", { name: "收藏店铺", exact: true }).click();
    await dialog.waitFor();
    assert(
      !writes.length,
      "Restaurant favorite sent a mutation before verification",
    );
    await dialog.getByRole("button", { name: "暂不", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    checks.push(
      "Restaurant favorite uses the shared request guard without a button-specific check",
    );
    await p.goto(base + "/");
    await p.getByRole("button", { name: "发布一道菜", exact: true }).click();
    await dialog.waitFor();
    assert(
      p.url() === base + "/" && !writes.length,
      "Publish skipped verification prompt",
    );
    await dialog.getByRole("button", { name: "暂不", exact: true }).click();
    checks.push(
      "Mobile publish button opens the same prompt without navigating",
    );
    verified = true;
    await p.goto(base + "/foods/71");
    await p.reload();
    await p.locator(".dish-like").waitFor();
    await p.locator(".dish-like").click();
    await p.locator('.dish-like[aria-pressed="true"]').waitFor();
    assert(
      writes.filter((x) => x === "/api/foods/71/like").length === 1,
      "Verified user like did not run exactly once",
    );
    assert((await dialog.count()) === 0, "Verified user was prompted");
    checks.push(
      "Verified users can like normally, with one intercepted mutation",
    );
    for (const width of [390, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      food.isFavorite = false;
      verified = true;
      await p.goto(base + "/foods/71");
      await p.reload();
      const previous = writes.length;
      await p.getByRole("button", { name: "收藏", exact: true }).click();
      await p.getByRole("button", { name: "取消收藏", exact: true }).waitFor();
      assert(
        writes.length === previous + 1 &&
          writes.at(-1) === "/api/foods/71/favorite",
        "Verified favorite did not run once",
      );
      assert((await dialog.count()) === 0, "Verified favorite was prompted");
      verified = false;
      await p.reload();
      await p.getByRole("button", { name: "取消收藏", exact: true }).click();
      await p.getByRole("button", { name: "收藏", exact: true }).waitFor();
      assert(
        writes.length === previous + 2 &&
          writes.at(-1) === "/api/foods/71/unfavorite",
        "Unverified user cannot remove an existing favorite",
      );
      assert(
        (await dialog.count()) === 0,
        "Removing a favorite incorrectly required verification",
      );
      checks.push(
        `${width}px: verified favorite succeeds; unverified removal remains allowed`,
      );
    }
    verified = true;
    rejectFavorite = true;
    await p.goto(base + "/foods/71");
    await p.reload();
    const beforeDenial = writes.length;
    const deniedFavorite = p.getByRole("button", { name: "收藏", exact: true });
    await deniedFavorite.click();
    await dialog.waitFor();
    await settled();
    assert(
      await dialog.isVisible(),
      "Server-denied prompt closed because of stale cached verification",
    );
    assert(
      writes.length === beforeDenial + 1,
      "Server-denied action retried automatically",
    );
    assert(
      !(await p.locator("body").innerText()).includes("权限不足"),
      "Raw backend error duplicated the guide",
    );
    await dialog.getByRole("button", { name: "暂不", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert(
      await deniedFavorite.evaluate((el) => document.activeElement === el),
      "Server-denied action lost focus",
    );
    assert(
      writes.length === beforeDenial + 1,
      "Dismissing server denial replayed the action",
    );
    checks.push(
      "Stale verified cache: server denial opens one prompt, preserves focus and never retries",
    );
    assert(errors.length === 0, errors.join("\n"));
    return { checks, errors, writes, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/verification-prompt-failure.png",
    });
    throw new Error(
      JSON.stringify({
        error: String(error),
        checks,
        errors,
        url: p.url(),
        text: (await p.locator("body").innerText()).slice(0, 1600),
      }),
    );
  } finally {
    await context.close();
  }
}
