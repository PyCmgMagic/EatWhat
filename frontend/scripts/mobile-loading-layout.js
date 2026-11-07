async function validateMobileLoading(page) {
  const browser = page.context().browser(),
    checks = [],
    errors = [];
  const base = "http://127.0.0.1:5173";
  const food = {
    id: 71,
    name: "招牌牛筋面",
    restaurantId: 9,
    restaurantName: "渔见17码头",
    price: 18.9,
    category: "staple",
    pictureUrl: [],
    systemTags: [],
    myCustomTags: [],
    likesCount: 1,
    isLiked: false,
    isFavorite: false,
  };
  const user = {
    id: 10,
    displayName: "测试同学",
    verified: true,
    banned: false,
    role: "user",
  };
  const routes = [
    ["/", "G2-Home", ".mobile-home-screen"],
    ["/home-photo", "G-HomePhoto", ".mobile-home-screen"],
    ["/foods/71", "G-Dish", ".mobile-dish-screen"],
    ["/me", "G-Me", ".mobile-profile-screen"],
    ["/restaurants/9", "G-Detail", ".design-screen"],
    ["/nearby", "G-Nearby", ".design-screen", false],
    ["/reference/G2-Home", "G2-Home", ".design-screen", false],
  ];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  for (const width of [440, 320, 390, 520]) {
    for (const [path, screen, loadedSelector, loadingData = true] of routes) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        isMobile: true,
        hasTouch: true,
      });
      const p = await context.newPage();
      p.setDefaultTimeout(10000);
      p.on("pageerror", (e) => errors.push(e.message));
      await p.emulateMedia({ reducedMotion: "reduce" });
      let releaseCode, releaseData;
      const codeReady = new Promise((r) => {
        releaseCode = r;
      });
      const dataReady = new Promise((r) => {
        releaseData = r;
      });
      await context.addInitScript(() => {
        if (location.hostname === "127.0.0.1")
          localStorage.setItem(
            "eatwhat-session",
            JSON.stringify({
              tokenName: "x-session",
              tokenValue: "isolated-loading-test",
            }),
          );
      });
      await context.route(
        (u) => u.origin !== base,
        (r) => r.abort(),
      );
      await context.route(
        (u) =>
          decodeURIComponent(u.pathname).includes(
            "virtual:eatwhat-screens/" + screen,
          ),
        async (r) => {
          await codeReady;
          await r.continue();
        },
      );
      await context.route(
        (u) => u.pathname.startsWith("/api/"),
        async (r) => {
          const url = new URL(r.request().url());
          assert(
            r.request().method() === "GET",
            "Loading triggered a mutation",
          );
          if (
            !["/api/campus/list", "/api/remote-config"].includes(url.pathname)
          )
            await dataReady;
          let data = {
            items: [],
            totalItems: 0,
            totalPages: 0,
            hasNext: false,
          };
          if (
            url.pathname === "/api/user/info" ||
            url.pathname === "/api/user/userInfo"
          )
            data = user;
          else if (url.pathname === "/api/foods/recommend") data = [food];
          else if (url.pathname === "/api/foods/detail/71") data = food;
          else if (url.pathname === "/api/restaurant/detail/9")
            data = { id: 9, name: "渔见17码头", address: "校园美食广场" };
          else if (url.pathname === "/api/campus/list")
            data = [{ id: 1, name: "软件园", isDefault: true, open: true }];
          else if (url.pathname === "/api/remote-config")
            data = {
              configVersion: 1,
              flags: {},
              params: {},
              maintenance: { mode: "NONE" },
              announcements: [],
              versions: {},
            };
          else if (url.pathname.includes("/topics")) data = [];
          else if (url.pathname === "/api/notification/unread/count") data = 0;
          await r.fulfill({ status: 200, json: { code: 0, data } });
        },
      );
      const measure = () =>
        p.evaluate(() => {
          const box = (selector) =>
            document.querySelector(selector)?.getBoundingClientRect().toJSON();
          return {
            viewport: box(".mobile-viewport"),
            canvas: box(".mobile-canvas"),
            skeleton: box(".ew-mobile-skeleton"),
            hero: box(".ew-mobile-skeleton-top"),
            sheet: box(".ew-mobile-skeleton-sheet"),
            scrollWidth: document.documentElement.scrollWidth,
            width: innerWidth,
            height: innerHeight,
          };
        });
      const checkLoading = async (stage) => {
        await p.locator(".ew-mobile-skeleton").waitFor();
        const m = await measure();
        const fits = [m.canvas, m.skeleton, m.hero, m.sheet].every(
          (b) =>
            b &&
            Math.abs(b.left - m.viewport.left) < 1 &&
            Math.abs(b.right - m.viewport.right) < 1,
        );
        assert(
          fits && m.scrollWidth <= width + 1,
          `${width}px ${path} ${stage} misaligned: ${JSON.stringify(m)}`,
        );
        assert(
          m.skeleton.height >= m.height - 1,
          `${width}px ${path} ${stage} leaves a vertical gap: ${JSON.stringify(m)}`,
        );
        const nav = p.getByRole("navigation", { name: "主导航", exact: true });
        if (["/", "/home-photo", "/me", "/nearby"].includes(path)) {
          await nav.waitFor();
          const box = await nav.boundingBox();
          assert(
            box &&
              box.x >= 0 &&
              box.x + box.width <= width &&
              box.y + box.height <= 900,
            "Loading displaced navigation",
          );
        }
        if (width === 440 && path === "/")
          await p.screenshot({
            path: `output/playwright/mobile-loading-${stage}-440.png`,
          });
        checks.push(
          `${width}px ${path} ${stage}: full width/height and aligned navigation`,
        );
      };
      try {
        await p.goto(base + "/?demo=0&view=mobile#" + path, {
          waitUntil: "domcontentloaded",
        });
        await p.locator(".mobile-code-loading").waitFor();
        await checkLoading("code");
        releaseCode();
        await p.locator(".mobile-code-loading").waitFor({ state: "detached" });
        if (loadingData) await checkLoading("data");
        releaseData();
        await p.locator(".ew-mobile-skeleton").waitFor({ state: "detached" });
        await p.locator(loadedSelector).waitFor();
        const box = await p.locator(loadedSelector).first().boundingBox();
        const viewport = await p.locator(".mobile-viewport").boundingBox();
        assert(
          box &&
            viewport &&
            Math.abs(box.width - viewport.width) < 1 &&
            Math.abs(box.x - viewport.x) < 1,
          "Loaded page shifted",
        );
      } catch (error) {
        await p.screenshot({
          path: "output/playwright/mobile-loading-failure.png",
        });
        throw new Error(
          JSON.stringify({ error: String(error), checks, errors }),
        );
      } finally {
        releaseCode();
        releaseData();
        await context.close();
      }
    }
  }
  assert(!errors.length, errors.join("\n"));
  return {
    checks: checks.length,
    details: checks,
    errors,
    realBackendRequests: 0,
  };
}
