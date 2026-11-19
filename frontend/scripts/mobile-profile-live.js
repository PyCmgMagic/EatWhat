async function validateMobileProfile(page) {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  const p = await context.newPage();
  const checks = [],
    errors = [],
    requests = [],
    outside = [];
  let user = {
    id: 10,
    displayName: "PyCmg",
    signature: "认真吃饭，认真生活。",
    avatar: "/prototype/assets/photos/sq_luosi.png",
    verified: true,
    banned: false,
    role: "user",
    userName: "profile_qa",
  };
  let listStatus = 200;
  p.setDefaultTimeout(10000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => requests.push(r.url()));
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1")
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-session",
          tokenValue: "isolated-layout-test",
        }),
      );
  });
  await context.route(
    (u) => u.hostname !== "127.0.0.1",
    (r) => {
      outside.push(r.request().url());
      return r.abort();
    },
  );
  const reply = (r, data, status = 200) =>
    r.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        code: status === 200 ? 0 : status,
        data,
        msg: status === 200 ? "ok" : "列表暂不可用",
      }),
    });
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    (r) => {
      const path = new URL(r.request().url()).pathname;
      if (path === "/api/user/info") return reply(r, user);
      if (path === "/api/user/userInfo")
        return reply(r, {
          ...user,
          earnedLikes: 7,
          uploadedFoodsCount: 0,
          fansCount: 2,
          followingsCount: 3,
        });
      if (path === "/api/campus/list")
        return reply(r, [
          { id: 1, name: "软件园", open: true, isDefault: true },
        ]);
      if (path === "/api/notification/unread/count") return reply(r, 0);
      if (
        [
          "/api/foods/my",
          "/api/foods/favorites",
          "/api/foods/tags/my",
        ].includes(path)
      )
        return reply(
          r,
          {
            items: [],
            currentPage: 1,
            totalItems: 0,
            totalPages: 0,
            hasNext: false,
          },
          listStatus,
        );
      return reply(r, []);
    },
  );
  const base = "http://127.0.0.1:5173/?view=mobile#";
  try {
    for (const width of [320, 390, 520]) {
      await p.setViewportSize({ width, height: 844 });
      await p.goto(base + "/settings");
      await p
        .locator(".mobile-settings-identity strong")
        .getByText(user.displayName, { exact: true })
        .waitFor();
      if (
        (await p.locator(".mobile-settings-avatar img").getAttribute("src")) !==
        user.avatar
      )
        throw new Error("settings did not use the API avatar");
      const preference = p.getByRole("link", {
        name: "口味偏好 · 让推荐更懂你",
        exact: true,
      });
      const logout = p.getByRole("button", { name: "退出登录", exact: true });
      const prefBox = await preference.boundingBox(),
        logoutBox = await logout.boundingBox();
      if (
        !prefBox ||
        !logoutBox ||
        logoutBox.y - prefBox.y - prefBox.height < 8
      )
        throw new Error(`settings footer overlaps at ${width}px`);
      if (width === 390)
        await p.screenshot({
          path: "output/playwright/mobile-settings-live-fixed.png",
          fullPage: true,
        });
      await logout.click();
      await p
        .getByRole("alertdialog", { name: "退出登录", exact: true })
        .waitFor();
      await p.getByRole("button", { name: "先不退", exact: true }).click();
      await p
        .getByRole("alertdialog", { name: "退出登录", exact: true })
        .waitFor({ state: "detached" });
      await p.getByRole("link", { name: "返回", exact: true }).click();
      await p
        .getByRole("heading", { name: user.displayName, exact: true })
        .waitFor();
      if (
        (await p.locator(".mobile-profile-avatar img").getAttribute("src")) !==
        user.avatar
      )
        throw new Error("profile did not use the API avatar");
      await p
        .getByRole("heading", { name: "还没有分享过菜", exact: true })
        .waitFor();
      const grid = await p.getByRole("tabpanel").boundingBox();
      const empty = await p.locator(".mobile-empty").boundingBox();
      if (!grid || !empty || Math.abs(grid.width - empty.width) > 2)
        throw new Error(`empty state does not span the grid at ${width}px`);
      const heading = p.getByRole("heading", {
        name: "还没有分享过菜",
        exact: true,
      });
      const headingBox = await heading.boundingBox();
      if (!headingBox || headingBox.height > (36 * width) / 390)
        throw new Error(`empty title wraps at ${width}px`);
      if (width === 390)
        await p.screenshot({
          path: "output/playwright/mobile-profile-empty-fixed.png",
          fullPage: true,
        });
      await p.getByRole("tab", { name: "收藏", exact: true }).click();
      await p
        .getByRole("heading", { name: "还没有收藏的菜", exact: true })
        .waitFor();
      await p.getByRole("link", { name: "去发现", exact: true }).waitFor();
      checks.push(
        `${width}px: API account/avatar, separated footer, logout dialog, full-width upload/favorite empty states`,
      );
    }
    user = {
      ...user,
      displayName: "十二个字的超长昵称测试呀",
      signature:
        "这是一段较长的个人签名，用来确认个人页面不会挤压统计或发生横向溢出。",
      avatar: null,
      verified: false,
    };
    await p.setViewportSize({ width: 320, height: 720 });
    await p.goto(base + "/settings");
    await p.reload();
    await p
      .locator(".mobile-settings-identity strong")
      .getByText(user.displayName, { exact: true })
      .waitFor();
    await p.getByText("去认证", { exact: true }).waitFor();
    if ((await p.locator(".mobile-settings-avatar").innerText()) !== "十")
      throw new Error("settings fallback avatar kept a prototype initial");
    await p.getByRole("link", { name: "返回", exact: true }).click();
    await p
      .getByRole("heading", { name: user.displayName, exact: true })
      .waitFor();
    const overflow = await p.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    if (overflow) throw new Error("long account content overflows the phone");
    await p.getByRole("link", { name: "编辑资料", exact: true }).click();
    await p.locator("#nick").waitFor();
    if ((await p.getByLabel("换头像", { exact: true }).innerText()) !== "十")
      throw new Error("editor fallback avatar kept a prototype initial");
    if ((await p.locator("#nick").inputValue()) !== user.displayName)
      throw new Error("editor does not match the current account");
    checks.push(
      "Long nickname/signature, missing avatar, unverified account and edit form remain consistent",
    );
    listStatus = 503;
    await p.goto(base + "/me");
    await p.reload();
    await p
      .getByRole("heading", { name: "暂时没能加载这些菜", exact: true })
      .waitFor();
    await p
      .getByRole("heading", { name: user.displayName, exact: true })
      .waitFor();
    await p.getByRole("tab", { name: /^收藏/ }).click();
    await p.getByRole("button", { name: "重新加载", exact: true }).waitFor();
    if (await p.getByText("鲜虾蟹籽云吞", { exact: true }).count())
      throw new Error("API failure fell back to prototype dishes");
    checks.push("Failed live list shows retry instead of prototype content");
    if (
      !requests.some((u) => u.includes("/api/user/info")) ||
      !requests.some((u) => u.includes("/api/foods/my"))
    )
      throw new Error("default mode did not use the live API transport");
    if (requests.some((u) => u.includes("/src/demo/transport")))
      throw new Error("default mode loaded the Mock transport");
    if (outside.length || errors.length)
      throw new Error("Unexpected remote access or runtime errors");
    checks.push(
      "Default mobile URL uses live API transport and never imports Mock",
    );
    return { checks, errors, outsideRequests: outside.length };
  } catch (error) {
    return {
      checks,
      errors,
      failure: String(error),
      url: p.url(),
      snapshot: await p.locator(".mobile-viewport").innerText(),
    };
  } finally {
    await context.close();
  }
}
