async (page) => {
  const browser = page.context().browser(), engine = browser.browserType().name();
  const base = new URL(page.url()).origin;
  const context = await browser.newContext({ viewport: { width: 1536, height: 700 }, reducedMotion: "reduce" });
  const p = await context.newPage(), checks = [], errors = [], writes = [];
  const food = {
    id: 91, name: "PyCmgMagic", category: "staple", price: 2,
    restaurantId: 1, restaurantName: "滨寿司", accountId: 21,
    user: { id: 21, displayName: "PyCmg" },
    stageColor: "matcha", likeCount: 9, isLiked: false, isFavorite: false,
    coverCrop: {centerX:0.25, centerY:0.5, diameter:0.5},
    tags: [], pictureUrls: ["/prototype/assets/photos/sq_luosi.png", "/assets/dessert.jpg"],
  };
  let current = food, holdDetail;
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  async function checkPhotoPreview(start, mobile = false) {
    const trigger = p.getByRole("button", { name: `查看${food.name}大图` });
    if (mobile) await trigger.click();
    else await trigger.press("Enter");
    const dialog = p.getByRole("dialog", { name: `${food.name} · 照片预览` });
    const image = dialog.getByRole("img");
    await image.waitFor();
    await image.evaluate(img => img.decode());
    assert(await image.getAttribute("src") === food.pictureUrls[start], "Preview opened the wrong photo");
    assert(await image.evaluate(img => {
      const {width, height} = img.getBoundingClientRect();
      return width <= innerWidth && height <= innerHeight &&
        Math.abs(width / height - img.naturalWidth / img.naturalHeight) < 0.01;
    }), "Preview cropped or distorted the original");
    const next = (start + 1) % food.pictureUrls.length;
    if (mobile) await dialog.getByRole("button", { name: "下一张照片" }).click();
    else await p.keyboard.press("ArrowRight");
    assert(await image.getAttribute("src") === food.pictureUrls[next], "Preview did not advance");
    if (mobile) await dialog.getByRole("button", { name: "关闭弹窗" }).click();
    else await p.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert(await trigger.evaluate(el => document.activeElement === el), "Preview lost the opening control");
  }
  p.on("pageerror", error => { if (!error.message.includes("ResizeObserver loop")) errors.push(error.message); });
  await context.route(url => url.origin !== base, route => route.abort());
  await context.route(url => url.origin === base && url.pathname.startsWith("/api/"), async route => {
    const path = new URL(route.request().url()).pathname;
    if (["/api/user/activity", "/api/device/register"].includes(path) && route.request().method() === "POST") {
      return route.fulfill({json:{code:0,data:null}});
    }
    if (["/api/foods/91/like", "/api/foods/91/unlike"].includes(path) && route.request().method() === "POST") {
      const isLiked = path.endsWith("/like");
      current = { ...current, isLiked, likeCount: food.likeCount + Number(isLiked) };
      return route.fulfill({json:{code:0,data:null}});
    }
    if (route.request().method() !== "GET") { writes.push(path); return route.abort(); }
    let data = [];
    if (path === "/api/foods/detail/91") { if (holdDetail) await holdDetail; data = current; }
    else if (path === "/api/user/info") data = { id:21, userName:"PyCmg", verified:true, role:"admin" };
    else if (path === "/api/notification/unread/count") data = 0;
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
    const header = [".pc-brand", ".pc-header nav", ".pc-header-actions"].map(bounds);
    return {
      width: innerWidth, height: innerHeight,
      main: bounds(".pc-main"), card: bounds(".pc-dish-layout"), stage: bounds(".pc-dish-stage"),
      info: bounds(".pc-dish-info"), actions: bounds(".pc-dish-actions"),
      photo: bounds(".pc-dish-photo"), copy: bounds(".pc-dish-copy"),
      radius: getComputedStyle(document.querySelector(".pc-dish-photo")).borderRadius,
      tools: bounds(".pc-dish-tools"),
      narrow: matchMedia("(max-width: 759px)").matches,
      stacked: document.querySelector(".pc-dish-info").getBoundingClientRect().top >= document.querySelector(".pc-dish-stage").getBoundingClientRect().bottom - 1,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      headerOverlap: header.some((a,i) => header.slice(i+1).some(b => Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)),
      clippedInfo: document.querySelector(".pc-dish-info").scrollHeight > document.querySelector(".pc-dish-info").clientHeight + 2,
      controls: bounds(".pc-gallery-controls"),
    };
  });
  const coverColors = (selector, layer = null) => p.locator(selector).evaluate((el, layer) => ({
    background: getComputedStyle(el, layer).backgroundColor,
    title: getComputedStyle(el).color,
  }), layer);
  try {
    await p.goto(base + "/?demo=0&view=desktop#/foods/91");
    await p.getByRole("heading", { name: food.name, exact: true }).waitFor();
    await p.locator(".pc-dish-shop small").getByText("高新万达4F", { exact: true }).waitFor();
    for (const [width, height] of [[1536,700],[1440,900],[1920,1080],[2560,1440],[1280,720],[1280,600],[1024,768],[900,700],[899,700],[820,700],[600,800]]) {
      await p.setViewportSize({ width, height });
      await settle();
      const m = await measure();
      assert(!m.overflow && !m.headerOverlap && !m.clippedInfo, "Layout overflow: " + JSON.stringify(m));
      assert(m.stacked === m.narrow, "Wrong note breakpoint: " + JSON.stringify(m));
      assert(m.photo.x > m.stage.x && m.photo.right < m.stage.right &&
        m.photo.y > m.stage.y && m.photo.bottom < m.stage.bottom, "Missing colored mat: " + JSON.stringify(m));
      assert(m.radius === "50%" && Math.abs(m.photo.width - m.photo.height) <= 1 &&
        Math.abs((m.photo.x + m.photo.right) - (m.stage.x + m.stage.right)) <= 2,
        "Dish plate must be circular and centered: " + JSON.stringify(m));
      assert(m.controls.y >= m.photo.bottom && m.controls.bottom < m.stage.bottom,
        "Photo controls must sit below the plate: " + JSON.stringify(m));
      if (!m.narrow) {
        assert(m.stage.right <= m.info.x + 1 && Math.abs(m.info.height - m.stage.height) < 1,
          "Photo and note are not adjacent: " + JSON.stringify(m));
        assert(m.actions.bottom <= height - 8, "Actions are outside the first screen: " + JSON.stringify(m));
      }
      checks.push({ width, height, cardHeight: Math.round(m.card.height), cardBottom: Math.round(m.card.bottom), photoWidth: m.photo.width, stacked: m.stacked });
      if ([1536,1440,2560,820].includes(width)) await p.screenshot({ path: `output/playwright/dish-responsive-${engine}-${width}x${height}.png` });
    }
    const cover = p.locator(".pc-dish-photo .food-cover-frame img");
    const framing = await cover.evaluate(img => ({w:parseFloat(img.style.width),left:parseFloat(img.style.left),top:parseFloat(img.style.top)}));
    assert(Math.abs(framing.w-200)<1 && Math.abs(framing.left)<1 && Math.abs(framing.top+50)<1, "Off-center crop did not match the stored source rectangle");
    await p.locator("#food-discussion").waitFor();
    const more = p.getByRole("button", { name: "更多菜品操作", exact: true });
    assert(await more.count() === 1, "Missing or duplicate desktop action menu");
    await more.press("ArrowDown");
    const menu = p.getByRole("group", { name: "更多菜品操作", exact: true });
    assert(await menu.getByRole("button", { name: "举报菜品", exact: true }).count() === 1,
      "Missing or duplicate desktop report entry");
    await p.keyboard.press("Escape");
    assert(await more.getAttribute("aria-expanded") === "false", "Action menu did not close");
    const nextPhoto = p.getByRole("button", { name: "下一张照片", exact: true });
    await nextPhoto.press("Enter");
    assert(await cover.count() === 0, "Secondary photo inherited the cover crop");
    assert(await p.locator(".pc-dish-photo img").getAttribute("src") === food.pictureUrls[1], "Gallery selection stopped working");
    assert(await p.locator(".pc-dish-photo img").evaluate(img => getComputedStyle(img).objectFit) === "cover", "Secondary photo must fill the plate");
    assert(await p.locator(".pc-gallery-controls [aria-live]").innerText() === "2 / 2", "Gallery counter did not update");
    await checkPhotoPreview(1);
    await p.getByRole("button", { name: "上一张照片", exact: true }).click();
    await cover.waitFor();
    const shop = p.locator(".pc-dish-actions").getByRole("link", { name: "去这家店", exact: true });
    await shop.scrollIntoViewIfNeeded();
    await shop.click({ trial: true });
    assert(await shop.getAttribute("href") === "#/restaurants/1", "Restaurant destination changed");

    // Long notes scroll independently. The photo and action row stay in view.
    current = { ...food, name: "鲜虾蟹籽云吞与酸辣牛筋面双人套餐 gypqj", description: "这是一段需要完整保留的菜品描述。".repeat(50), tags: Array.from({length:8}, (_,i) => "食友推荐标签"+(i+1)) };
    await p.setViewportSize({ width: 1280, height: 720 });
    await p.reload();
    await p.getByRole("heading", { name: current.name, exact: true }).waitFor();
    await settle();
    const long = await measure();
    assert(!long.clippedInfo && !long.overflow && long.photo.right < long.copy.x && long.actions.bottom <= long.height, "Long content broke the detail layout");
    assert(await p.locator(".pc-dish-description").textContent() === current.description, "Description was truncated");
    const reader = p.locator(".pc-dish-reading");
    await reader.focus();
    await reader.press("End");
    await p.waitForFunction(() => document.querySelector(".pc-dish-reading").scrollTop > 0);
    await reader.getByRole("region", { name: "菜品评分" }).getByRole("button").click({ trial: true });
    await more.click();
    const report = p.getByRole("button", { name: "举报菜品", exact: true });
    assert(await report.getAttribute("aria-haspopup") === "dialog", "Report dialog entry changed");
    await report.click({ trial: true });
    assert(!(await p.getByRole("link", {name:"编辑菜品"}).count()), "Guests can see owner actions");
    await p.keyboard.press("Escape");
    assert(await more.evaluate(el => document.activeElement === el && el.getAttribute("aria-expanded") === "false"), "Escape did not dismiss and restore focus");
    await more.press("Enter");
    await report.click();
    const reportDialog = p.getByRole("dialog", { name: "举报菜品", exact: true });
    await reportDialog.getByText(current.name, { exact: true }).waitFor();
    await reportDialog.getByRole("button", { name: "取消", exact: true }).click();
    await reportDialog.waitFor({ state: "hidden" });
    assert(await more.getAttribute("aria-expanded") === "false", "Action menu stayed open after reporting was cancelled");

    // Loading uses the same height budget instead of briefly restoring a 690px panel.
    current = food;
    let release;
    holdDetail = new Promise(resolve => { release = resolve; });
    await p.reload();
    await p.locator(".ew-page-skeleton.dish .pc-dish-layout").waitFor();
    const loadingHeight = await p.locator(".ew-page-skeleton.dish .pc-dish-stage").evaluate(el => el.offsetHeight);
    release(); holdDetail = undefined;
    await p.getByRole("heading", { name: food.name, exact: true }).waitFor();
    const ready = await measure();
    assert(loadingHeight >= ready.photo.height && Math.abs(loadingHeight - ready.stage.height) < 85,
      "Loading does not match the detail cover: " + loadingHeight);

    await p.evaluate(() => localStorage.setItem("eatwhat-session", JSON.stringify({tokenName:"x-dish-test",tokenValue:"local-only"})));
    await p.setViewportSize({width:1440,height:900});
    await p.reload();
    await more.click();
    const edit = p.getByRole("link", {name:"编辑菜品",exact:true});
    await edit.waitFor();
    assert(await edit.getAttribute("href") === "#/foods/91/edit", "Owner edit destination changed");
    await p.locator("#food-discussion").waitFor();
    await settle();
    await p.screenshot({path:`output/playwright/dish-action-menu-${engine}.png`});
    await p.getByRole("button", {name:"删除菜品",exact:true}).click();
    const confirmation = p.getByRole("dialog");
    await confirmation.getByText(/删除「PyCmgMagic」/).waitFor();
    await confirmation.getByRole("button", {name:"取消",exact:true}).click();
    await confirmation.waitFor({state:"hidden"});
    assert(await more.getAttribute("aria-expanded") === "false", "Management menu stayed open after deletion was cancelled");
    const actions = p.locator(".pc-dish-actions");
    assert(await actions.getByRole("link").count() === 1 && await shop.isVisible(), "Unexpected dish action link");
    const like = actions.getByRole("button");
    const likeStyle = () => like.evaluate(el => {
      const {x, y, width, height} = el.getBoundingClientRect();
      const {background, boxShadow} = getComputedStyle(el);
      return {x, y, width, height, background, boxShadow};
    });
    await like.hover();
    const beforeLike = await likeStyle();
    for (const [pressed, count] of [[true, "10"], [false, "9"]]) {
      await like.click();
      await actions.locator(`button[aria-pressed="${pressed}"]`).getByText(count, {exact:true}).waitFor();
      assert(JSON.stringify(await likeStyle()) === JSON.stringify(beforeLike), "Like toggle changed its size, position or surface");
    }
    await p.getByRole("heading", { name: /吃过的人说/ }).scrollIntoViewIfNeeded();
    const desktopColors = await coverColors(".pc-dish-stage", "::before");
    await p.setViewportSize({width:390,height:844});
    await p.goto(base + "/?demo=0&view=mobile#/foods/91");
    await p.waitForFunction(() => parseFloat(document.querySelector(".dish-plate .food-cover-frame img")?.style.width) === 200);
    const mobileColors = await coverColors(".dish-hero");
    assert(desktopColors.background === mobileColors.background && desktopColors.title === mobileColors.title &&
      desktopColors.background !== "rgba(0, 0, 0, 0)", "Desktop and mobile must share the dish cover colors");
    await p.locator(".dish-actions").getByRole("link", { name: "去这家店" }).waitFor();
    await checkPhotoPreview(0, true);
    await p.getByLabel("更多菜品操作", { exact: true }).click();
    await p.getByRole("button", { name: "举报这道菜", exact: true }).waitFor();
    assert(errors.length === 0 && writes.length === 0, JSON.stringify({errors,writes}));
    return {engine, checks, loadingHeight, longContentPhotoWidth:long.photo.width, realBackendRequests:0};
  } catch (error) {
    await p.screenshot({path:`output/playwright/dish-responsive-${engine}-failure.png`});
    throw error;
  } finally { await context.close(); }
}
