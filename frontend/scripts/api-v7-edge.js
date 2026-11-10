async function validateApiV7Edges(page) {
  const base = new URL(page.url()).origin,
    checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(() =>
    localStorage.setItem(
      "eatwhat-session",
      JSON.stringify({
        tokenName: "satoken",
        tokenValue: "v7-isolated-session",
      }),
    ),
  );
  let mode = "404",
    galleryReads = 0;
  const sessionHeaders = [];
  const uuid = "11111111-1111-4111-8111-111111111111";
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === "/v7-expired.jpg")
      return route.fulfill({ status: 403, body: "expired" });
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname.slice(4);
    const reply = (data, status = 200, code = 0, msg = "ok") =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ code, msg, data, timestamp: Date.now() }),
      });
    if (path === "/user/info")
      return reply({
        id: 10,
        displayName: "测试同学",
        verified: true,
        role: "user",
        level: 3,
        totalExperience: 125,
      });
    if (path === "/campus/list")
      return reply([
        { id: 1, name: "软件园校区", open: true, isDefault: true },
      ]);
    if (path === "/remote-config")
      return reply({
        flags: {},
        params: {},
        maintenance: { mode: "NONE" },
        announcements: [],
      });
    if (path === "/foods/detail/1")
      return reply({
        id: 1,
        name: "云吞",
        restaurantName: "校园小店",
        pictureUrl: [],
      });
    if (path === "/foods/1/comments") {
      sessionHeaders.push(req.headers()["satoken"]);
      if (mode === "404") return reply(null, 404, "NOT_FOUND");
      if (mode === "403")
        return reply(null, 403, "FORBIDDEN", "无权读取这条评论");
      if (mode === "business") return reply(null, 200, 40001, "评论读取失败");
      return reply({
        currentPage: 1,
        totalItems: 1,
        totalPages: 1,
        hasNext: false,
        items: [
          {
            id: 1,
            gid: uuid,
            revisionId: uuid,
            kind: "COMMENT",
            foodId: 1,
            rootCommentGid: uuid,
            replyToGid: null,
            authorName: "食友",
            text: "真实适配层的隔离数据",
            likesCount: 1,
            images: [],
            createdAt: "2026-11-10T01:00:00Z",
          },
        ],
      });
    }
    if (path === "/foods/1/gallery") {
      galleryReads++;
      return reply({
        currentPage: 1,
        totalItems: 1,
        totalPages: 1,
        hasNext: false,
        items: [
          {
            commentId: 1,
            commentGid: uuid,
            createdAt: "2026-11-10T01:00:00Z",
            image: {
              slot: 0,
              url:
                base +
                (galleryReads === 1
                  ? "/v7-expired.jpg"
                  : "/prototype/assets/photos/p_luosi.png"),
              expiresInSeconds: 300,
            },
          },
        ],
      });
    }
    if (path === "/comments/1/like")
      return reply({
        commentId: 1,
        liked: false,
        likesCount: 1,
        authorLikesCount: 1,
      });
    return reply({ items: [], hasNext: false });
  });
  await p.goto(`${base}/?demo=0&view=mobile#/comments?foodId=1`);
  await p.getByText("评论暂未开放，请稍后再试。", { exact: true }).waitFor();
  mode = "403";
  await p.getByRole("button", { name: "重新加载", exact: false }).click();
  await p.getByText("无权读取这条评论", { exact: true }).waitFor();
  mode = "business";
  await p.getByRole("button", { name: "重新加载", exact: false }).click();
  await p.getByText("评论读取失败", { exact: true }).waitFor();
  mode = "success";
  await p.getByRole("button", { name: "重新加载", exact: false }).click();
  await p.getByText("真实适配层的隔离数据", { exact: true }).waitFor();
  assert(
    sessionHeaders.every((value) => value === "Bearer v7-isolated-session"),
    "Optional session omitted",
  );
  checks.push(
    "404 unavailable, 403 denial, HTTP 200 business error and retry",
    "optional login header preserved",
  );
  await p.getByRole("button", { name: "晒图", exact: true }).click();
  await p.waitForFunction(() =>
    document
      .querySelector(".comments-gallery img")
      ?.getAttribute("src")
      ?.includes("p_luosi.png"),
  );
  assert(galleryReads === 2, `Expired image triggered ${galleryReads} reads`);
  checks.push("expired signed image refreshed once");
  await context.close();

  for (const persona of ["guest", "unverified"]) {
    const c = await page
      .context()
      .browser()
      .newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
    const t = await c.newPage();
    t.on("pageerror", (e) => errors.push(e.message));
    await c.route("**/*", (route) =>
      new URL(route.request().url()).origin === base
        ? route.continue()
        : route.abort(),
    );
    if (persona === "guest")
      await c.addInitScript(() =>
        localStorage.setItem("eatwhat-demo-session", "null"),
      );
    await t.goto(
      `${base}/?demo=1&view=mobile&persona=${persona}#/comments?foodId=1`,
    );
    const root = t
      .locator(".comments-row")
      .filter({ hasText: "分量很实在，趁热吃更好。" });
    await root.waitFor();
    if (persona === "guest") {
      await root
        .getByRole("button", { name: "觉得这条评论有用", exact: true })
        .click();
      await t.getByRole("heading", { name: "登录", exact: true }).waitFor();
      checks.push("guest reads public comments; action opens login");
    } else {
      await t
        .getByRole("button", { name: "吃过的话，说两句", exact: true })
        .click();
      await t
        .getByRole("textbox", { name: "说说你的用餐感受", exact: true })
        .fill("未认证同学的纯文字评论");
      await t.getByRole("button", { name: "发表评论", exact: true }).click();
      await t.waitForFunction(() =>
        location.hash.startsWith("#/me/shares?tab=comments"),
      );
      await t.getByText("未认证同学的纯文字评论", { exact: true }).waitFor();
      await t.goto(
        `${base}/?demo=1&view=mobile&persona=unverified#/comments/write?foodId=1`,
      );
      await t.getByRole("button", { name: "添加图片", exact: false }).click();
      await t.getByRole("dialog").waitFor();
      checks.push(
        "unverified text submission succeeds; image selection opens verification",
      );
    }
    await c.close();
  }
  assert(errors.length === 0, errors.join("; "));
  return { checks, browserErrors: errors, realBackendRequests: 0 };
}
