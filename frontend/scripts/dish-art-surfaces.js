async function validateDishArtSurfaces(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  p.on("pageerror", (error) => errors.push(error.message));
  await p.emulateMedia({ reducedMotion: "reduce" });
  await context.addInitScript(() =>
    localStorage.setItem(
      "eatwhat-session",
      JSON.stringify({ tokenName: "x-art", tokenValue: "isolated-art-check" }),
    ),
  );
  await context.route(
    (u) => u.origin !== base,
    (r) => r.abort(),
  );
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    (r) => {
      const path = new URL(r.request().url()).pathname;
      let data = { items: [], totalItems: 0, totalPages: 0, hasNext: false };
      if (path === "/api/user/info")
        data = {
          id: 10,
          displayName: "校园食友",
          verified: true,
          banned: false,
          role: "user",
        };
      if (path === "/api/user/growth")
        data = {
          level: 3,
          totalExperience: 125,
          experienceInLevel: 25,
          levelStartExperience: 100,
          nextLevelExperience: 250,
          experienceToNextLevel: 125,
          dailyExperience: 5,
        };
      if (path === "/api/user/activity")
        data = { firstUseToday: false, experienceAdded: 0 };
      if (path === "/api/campus/list")
        data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
      if (path === "/api/notification/unread/count") data = 0;
      if (path === "/api/remote-config")
        data = {
          configVersion: 1,
          flags: {},
          params: {},
          maintenance: { mode: "NONE" },
          announcements: [],
          versions: {},
        };
      return r.fulfill({ json: { code: 0, data } });
    },
  );
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  try {
    for (const width of [320, 390, 1440]) {
      await p.setViewportSize({ width, height: 844 });
      for (const [route, selector, dish] of [
        ["/me/growth", ".growth-summary", "danchaofan"],
        ["/history", width < 600 ? ".mobile-empty" : ".pc-library-empty", "baozi"],
        ["/help", ".profile-help-contact", "baozi"],
        ["/feedback/mine", ".v4-state", "yangzhi"],
        ["/restaurants/favorites", ".v4-state", "jiaozi"],
        ["/topics", ".v4-state", "xiangguo"],
      ]) {
        await p.goto(`${base}/?demo=0#${route}`);
        await p.locator("body").ariaSnapshot();
        const root = p.locator(selector).first(),
          art = root.locator(".dish-illustration").first(),
          img = art.locator("img");
        await img.waitFor();
        await img.evaluate((el) => el.decode());
        await p.evaluate(() => document.fonts.ready);
        assert(
          (await img.getAttribute("src")).endsWith(`/${dish}.svg`),
          "Wrong dish on " + route,
        );
        assert(
          (await art.getAttribute("aria-hidden")) === "true",
          "Decorative artwork is exposed to assistive technology",
        );
        const bounds = await art.boundingBox();
        assert(
          bounds.width > 0 &&
            Math.abs(bounds.width - bounds.height) < 1 &&
            bounds.x >= -1 &&
            bounds.x + bounds.width <= width + 1,
          "Clipped or distorted illustration on " + route,
        );
        assert(
          !(await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          )),
          "Page overflows on " + route,
        );
        if (route === "/me/growth") {
          await p.locator(".growth-records > details > summary").click();
          await p
            .getByRole("heading", { name: "还没有经验记录", exact: true })
            .waitFor();
          await p
            .locator('.v4-state img[src$="/baozi.svg"]')
            .evaluate((el) => el.decode());
          const title = await p.locator(".growth-level").boundingBox();
          assert(
            bounds.x + bounds.width <= title.x + 1,
            "Growth dish overlaps the level",
          );
        }
        if (
          width === 390 ||
          (width === 1440 && ["/me", "/me/growth", "/help"].includes(route))
        )
          await p.screenshot({
            path: `output/playwright/dish-surfaces-${width}-${route.slice(1).replaceAll("/", "-")}.png`,
            fullPage: true,
          });
        checks.push(
          `${width}px ${route}: correct SVG, square artwork, decorative semantics, no overflow`,
        );
      }
    }
    await context.route("**/assets/dishes/danchaofan.svg", (r) => r.abort());
    await p.goto(`${base}/?demo=0#/me/growth`);
    await p.reload();
    await p.locator(".growth-summary .dish-illustration > svg").waitFor();
    await p.getByRole("heading", { name: "Lv.3", exact: true }).waitFor();
    checks.push(
      "Missing new SVG uses the existing fallback and preserves growth content",
    );
    assert(errors.length === 0, errors.join("; "));
    return { checks, errors, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/dish-surfaces-failure.png",
      fullPage: true,
    });
    throw Error(`${error.message}; ${p.url()}; completed ${checks.length}`);
  } finally {
    await context.close();
  }
}
