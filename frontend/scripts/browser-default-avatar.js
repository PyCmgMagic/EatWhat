async (seed) => {
  const base = new URL(seed.url()).origin;
  const context = await seed.context().browser().newContext({ reducedMotion: "reduce" });
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  const checks = [];
  let active = "";
  const defaultAvatar = "/assets/avatars/default-pig.webp";
  let avatar = null;
  await context.addInitScript(() => localStorage.setItem("eatwhat-session", JSON.stringify({ tokenName: "satoken", tokenValue: "isolated-avatar-test" })));
  await context.route(() => true, route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === "/assets/avatar-missing.svg") return route.fulfill({ status: 404, body: "" });
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let data = { items: [], totalItems: 0, hasNext: false };
    if (url.pathname === "/api/user/info") data = { id: 11, displayName: "我自己", avatar: null, verified: true, banned: false };
    else if (url.pathname === "/api/user/userInfo") data = { id: 21, displayName: "心月狐", avatar, level: 2, fansVisible: true, followingsVisible: true, isFollowingHim: false, uploadedFoodsCount: 0 };
    else if (url.pathname === "/api/remote-config") data = { flags: {}, params: {}, maintenance: { mode: "NONE" } };
    else if (url.pathname === "/api/campus/list") data = [];
    else if (url.pathname === "/api/user/blocks/21") data = { blocked: false };
    return route.fulfill({ json: { code: 0, data } });
  });
  try {
    for (const theme of ["light", "dark"]) {
      await p.emulateMedia({ colorScheme: theme });
      for (const [view, width, selector] of [
        ["desktop", 1440, ".profile-overview-avatar img"],
        ["mobile", 390, ".mobile-user-identity .mobile-user-avatar img"],
      ]) {
        await p.setViewportSize({ width, height: 900 });
        for (const source of [null, "/assets/avatar-missing.svg", "/prototype/assets/photos/sq_luosi.png"]) {
          active = `${theme}/${view}/${source}`;
          avatar = source;
          const target = `${base}/?demo=0&view=${view}#/users/21`;
          if (p.url() === target) await p.reload();
          else await p.goto(target);
          const expected = source?.includes("sq_luosi") ? source : defaultAvatar;
          await p.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.getAttribute("src") === expected, { selector, expected });
          const image = p.locator(selector);
          await image.evaluate(img => img.decode());
          const size = await image.boundingBox();
          if (!size || size.width < 32 || Math.abs(size.width - size.height) > 1)
            throw Error(`Avatar does not fit its circle: ${theme}/${view}/${source}`);
          checks.push({ theme, view, source, displayed: expected });
          if (!source) await p.screenshot({ path: `output/playwright/default-avatar-${view}-${theme}.png` });
          if (!source && theme === "light" && view === "desktop")
            await p.locator(".profile-overview-identity").screenshot({ path: "output/playwright/default-avatar-profile-preview.png" });
        }
      }
    }
    return { checks, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({ path: "output/playwright/default-avatar-failure.png" });
    throw Error(active + ": " + error.message + "\n" + await p.locator("body").innerText());
  } finally { await context.close(); }
}
