async (seed) => {
  const base = new URL(seed.url()).origin;
  const context = await seed.context().browser().newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const checks = [], errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const shapes = { square: [1200, 1200], landscape: [1600, 900], portrait: [900, 1600] };
  let crop = { centerX: 0.5, centerY: 0.5, diameter: 0.7 };
  let shape = "square";
  const photo = () => `/assets/food-cover-${shape}.svg`;
  const food = () => ({
    id: 91, name: "封面取景回归", category: "staple", price: 7,
    restaurantId: 1, restaurantName: "测试餐厅", accountId: 21,
    user: { id: 21, displayName: "测试用户" },
    coverCrop: crop, stageColor: "soy", tags: [],
    pictureUrls: [photo(), "/assets/food-cover-square.svg"],
  });
  await context.route(() => true, route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    const shapeName = /^\/assets\/food-cover-(\w+)\.svg$/.exec(url.pathname)?.[1];
    if (shapeName && shapes[shapeName]) {
      const [width, height] = shapes[shapeName];
      return route.fulfill({ contentType: "image/svg+xml", body:
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path fill="#b73522" d="M0 0h${width}v${height}H0z"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 3}" fill="#e7aa38"/></svg>` });
    }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let data = [];
    if (url.pathname === "/api/foods/detail/91") data = food();
    else if (url.pathname === "/api/recommend") data = {
      items: [{ id: 1, name: "测试餐厅", signatureFoods: [{ ...food(), pictureUrl: photo() }] }],
      mealTime: "lunch", hasNext: false,
    };
    else if (url.pathname === "/api/foods/recommend") data = [food()];
    else if (url.pathname === "/api/foods/list") data = { items: [food()], totalItems: 1, totalPages: 1, currentPage: 1, hasNext: false };
    else if (url.pathname === "/api/restaurant/detail/1") data = { id: 1, name: "测试餐厅" };
    else if (url.pathname === "/api/campus/list") data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
    else if (url.pathname === "/api/remote-config") data = { flags: {}, params: {}, maintenance: { mode: "NONE" } };
    else if (url.pathname === "/api/notification/unread/count") data = 0;
    return route.fulfill({ json: { code: 0, data } });
  });
  async function checkImage(selector, label) {
    const image = page.locator(selector);
    try { await image.waitFor(); } catch (error) {
      throw Error(label + ": " + error.message + "\n" + await page.locator("body").innerText());
    }
    await image.evaluate(img => img.decode());
    if (await image.evaluate(img => img.parentElement.classList.contains("food-cover-frame"))) {
      await page.waitForFunction(selector => document.querySelector(selector)?.style.width, selector);
    }
    const geometry = await image.evaluate(img => {
      const bounds = img.parentElement.getBoundingClientRect(), rect = img.getBoundingClientRect();
      const style = getComputedStyle(img.parentElement);
      const frame = {
        left: bounds.left + parseFloat(style.borderLeftWidth),
        right: bounds.right - parseFloat(style.borderRightWidth),
        top: bounds.top + parseFloat(style.borderTopWidth),
        bottom: bounds.bottom - parseFloat(style.borderBottomWidth),
      };
      return {
        maxWidth: getComputedStyle(img).maxWidth,
        blankRight: Math.max(0, frame.right - rect.right),
        fillsFrame: rect.left <= frame.left + 1 && rect.right >= frame.right - 1 &&
          rect.top <= frame.top + 1 && rect.bottom >= frame.bottom - 1,
        ratio: rect.width / rect.height, sourceRatio: img.naturalWidth / img.naturalHeight,
      };
    });
    if (!geometry.fillsFrame || Math.abs(geometry.ratio - geometry.sourceRatio) > 0.01)
      throw Error(label + ": cropped photo leaves a blank edge or is distorted: " + JSON.stringify(geometry));
    checks.push({ label, ...geometry });
  }
  try {
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      for (const [name, framing] of [
        ["square", { centerX: 0.5, centerY: 0.5, diameter: 0.7 }],
        ["landscape", { centerX: 0.7, centerY: 0.3, diameter: 0.6 }],
        ["portrait", { centerX: 0.3, centerY: 0.7, diameter: 0.6 }],
      ]) {
        shape = name; crop = framing;
        for (const [view, width, selector] of [
          ["desktop", 1440, ".pc-dish-photo .food-cover-frame img"],
          ["mobile", 390, ".dish-plate .food-cover-frame img"],
        ]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(`${base}/?demo=0&view=${view}#/foods/91`);
          await checkImage(selector, `${theme}/${view}/detail/${shape}`);
          if (theme === "light" && view === "desktop" && shape === "square")
            await page.screenshot({ path: "output/playwright/food-cover-fixed.png" });
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`${base}/?demo=0&view=desktop#/`);
        await checkImage(".pc-current-plate .food-cover-frame img", `${theme}/desktop/home/${shape}`);
      }
    }
    shape = "square";
    for (const framing of [null, { centerX: 0.5, centerY: 0.5, diameter: 1 }]) {
      crop = framing;
      await page.goto(`${base}/?demo=0&view=desktop#/foods/91`);
      await checkImage(".pc-dish-photo > img", `desktop/uncropped/${JSON.stringify(crop)}`);
    }
    if (errors.length) throw Error(JSON.stringify(errors));
    return { checks, realBackendRequests: 0 };
  } finally {
    await context.close();
  }
}
