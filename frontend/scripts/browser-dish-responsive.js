async (page) => {
  const browser = page.context().browser(), engine = browser.browserType().name();
  const base = "http://127.0.0.1:5173";
  const context = await browser.newContext({ viewport: { width: 1536, height: 700 }, reducedMotion: "reduce" });
  const p = await context.newPage(), checks = [], errors = [], writes = [];
  const food = {
    id: 91, name: "PyCmgMagic", category: "staple", price: 2,
    restaurantId: 1, restaurantName: "滨寿司", accountId: 21,
    user: { id: 21, displayName: "PyCmg" },
    stageColor: "matcha", likesCount: 0, isLiked: false, isFavorite: false,
    systemTags: [], pictureUrl: ["/prototype/assets/photos/sq_luosi.png", "/prototype/assets/photos/sq_tieguo.png"],
  };
  let current = food, holdDetail;
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  p.on("pageerror", error => { if (!error.message.includes("ResizeObserver loop")) errors.push(error.message); });
  await context.route(url => url.origin !== base, route => route.abort());
  await context.route(url => url.origin === base && url.pathname.startsWith("/api/"), async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") { writes.push(path); return route.abort(); }
    let data = [];
    if (path === "/api/foods/detail/91") { if (holdDetail) await holdDetail; data = current; }
    else if (path === "/api/restaurant/detail/1") data = { id: 1, name: "滨寿司", address: "高新万达4F" };
    else if (path === "/api/campus/list") data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
    else if (path === "/api/remote-config") data = { configVersion: 1, flags: {}, params: {}, maintenance: { mode: "NONE" }, announcements: [], versions: {} };
    return route.fulfill({ json: { code: 0, data } });
  });
  const settle = () => p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll(".pc-dish-stage img")].map(img => img.decode()));
    window.scrollTo(0, 0);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const measure = () => p.evaluate(() => {
    const bounds = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const stage = document.querySelector(".pc-dish-stage"), plate = stage.querySelector(".pc-plate");
    const header = [".pc-brand", ".pc-header nav", ".pc-header-actions"].map(bounds);
    return {
      width: innerWidth, height: innerHeight,
      main: bounds(".pc-main"), card: bounds(".pc-dish-layout"), stage: bounds(".pc-dish-stage"),
      info: bounds(".pc-dish-info"), actions: bounds(".pc-dish-actions"),
      photo: { width: plate.offsetWidth, height: plate.offsetHeight,
        centerX: plate.getBoundingClientRect().x + plate.getBoundingClientRect().width / 2,
        right: plate.getBoundingClientRect().right },
      stacked: getComputedStyle(document.querySelector(".pc-dish-layout")).gridTemplateColumns.split(" ").length === 1,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      headerOverlap: header.some((a,i) => header.slice(i+1).some(b => Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)),
      clippedInfo: document.querySelector(".pc-dish-info").scrollHeight > document.querySelector(".pc-dish-info").clientHeight + 2,
      thumbnails: bounds(".pc-photo-thumbnails"),
    };
  });
  try {
    await p.goto(base + "/?demo=0&view=desktop#/foods/91");
    await p.getByRole("heading", { name: food.name, exact: true }).waitFor();
    await p.locator(".pc-dish-shop small").getByText("高新万达4F", { exact: true }).waitFor();
    for (const [width, height] of [[1536,700],[1440,900],[1920,1080],[2560,1440],[1280,720],[1280,600],[1024,768],[900,700],[899,700],[820,700],[600,800]]) {
      await p.setViewportSize({ width, height });
      await settle();
      const m = await measure();
      assert(!m.overflow && !m.headerOverlap && !m.clippedInfo, "Layout overflow: " + JSON.stringify(m));
      assert(m.main.width <= 1361 && Math.abs(m.photo.width-m.photo.height)<1 && m.photo.width<=420, "Unbounded content/photo: " + JSON.stringify(m));
      assert(m.photo.centerX > m.stage.x + m.stage.width * 0.6 && m.photo.right > m.stage.right,
        "The original right-aligned, partially cropped plate composition was lost: " + JSON.stringify(m));
      assert(m.stacked === (width < 900), "Wrong detail breakpoint: " + JSON.stringify(m));
      assert(m.thumbnails.bottom <= m.stage.bottom && m.thumbnails.y >= m.stage.y, "Gallery escaped the image stage");
      if (width >= 900 && height <= 780) {
        assert(m.card.height < 610 && m.actions.bottom < height-8, "Short screen still has oversized details: " + JSON.stringify(m));
      }
      checks.push({ width, height, cardHeight: Math.round(m.card.height), cardBottom: Math.round(m.card.bottom), photoDiameter: m.photo.width, stacked: m.stacked });
      if ([1536,1440,2560,820].includes(width)) await p.screenshot({ path: `output/playwright/dish-responsive-${engine}-${width}x${height}.png` });
    }
    await p.getByRole("button", { name: "查看第 2 张照片", exact: true }).click();
    assert((await p.locator(".pc-dish-plate img").getAttribute("src")).endsWith("sq_tieguo.png"), "Gallery selection stopped working");
    assert(await p.getByRole("button", { name: "查看第 2 张照片", exact: true }).getAttribute("aria-pressed") === "true", "Gallery selection state was lost");
    const shop = p.locator(".pc-dish-actions").getByRole("link", { name: "去这家店", exact: true });
    await shop.scrollIntoViewIfNeeded();
    await shop.click({ trial: true });
    assert(await shop.getAttribute("href") === "#/restaurants/1", "Restaurant destination changed");

    // Long user content grows the document; it must not stretch the photo or be clipped.
    current = { ...food, name: "鲜虾蟹籽云吞与酸辣牛筋面双人套餐 gypqj", description: "这是一段需要完整保留的菜品描述。".repeat(50), systemTags: Array.from({length:8}, (_,i) => ({id:i+1,name:"食友推荐标签"+(i+1),count:i+2})) };
    await p.setViewportSize({ width: 1280, height: 720 });
    await p.reload();
    await p.getByRole("heading", { name: current.name, exact: true }).waitFor();
    await settle();
    const long = await measure();
    assert(!long.clippedInfo && !long.overflow && long.photo.width<=420, "Long content broke the detail layout");
    assert(await p.locator(".pc-dish-description").textContent() === current.description, "Description was truncated");
    await p.locator(".pc-detail-secondary").scrollIntoViewIfNeeded();
    await p.locator(".pc-detail-secondary").getByRole("link", { name: "举报", exact: true }).click({ trial: true });

    // Loading uses the same height budget instead of briefly restoring a 690px panel.
    current = food;
    let release;
    holdDetail = new Promise(resolve => { release = resolve; });
    await p.reload();
    await p.locator(".ew-page-skeleton.dish .pc-dish-layout").waitFor();
    const loadingHeight = await p.locator(".ew-page-skeleton.dish .pc-dish-layout").evaluate(el => el.offsetHeight);
    release(); holdDetail = undefined;
    await p.getByRole("heading", { name: food.name, exact: true }).waitFor();
    assert(loadingHeight < 610, "Loading restored the oversized detail card: " + loadingHeight);
    assert(errors.length === 0 && writes.length === 0, JSON.stringify({errors,writes}));
    return {engine, checks, loadingHeight, longContentPhotoDiameter:long.photo.width, realBackendRequests:0};
  } catch (error) {
    await p.screenshot({path:`output/playwright/dish-responsive-${engine}-failure.png`});
    throw error;
  } finally { await context.close(); }
}
