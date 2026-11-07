async function validatePeopleSheet(page) {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  const p = await context.newPage(),
    checks = [],
    errors = [];
  p.setDefaultTimeout(10000);
  p.on("pageerror", (error) => errors.push(error.message));
  const user = { id: 10, displayName: "PyCmg", verified: true, banned: false };
  let populated = false;
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1")
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-session",
          tokenValue: "isolated-people-sheet",
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
      if (r.request().method() !== "GET") {
        errors.push("Unexpected write: " + path);
        return r.abort();
      }
      let data = [];
      if (path === "/api/user/info") data = user;
      else if (path === "/api/user/userInfo")
        data = {
          ...user,
          fansCount: populated ? 20 : 0,
          followingsCount: 0,
          fansVisible: true,
          followingsVisible: true,
          earnedLikes: 0,
          uploadedFoodsCount: 0,
        };
      else if (path === "/api/campus/list")
        data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
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
      else if (/\/user\/(followers|followings)$/.test(path)) {
        const items =
          populated && path.endsWith("followers")
            ? Array.from({ length: 20 }, (_, i) => ({
                id: 100 + i,
                displayName: `食友 ${i + 1}`,
              }))
            : [];
        data = {
          items,
          totalItems: items.length,
          totalPages: 1,
          hasNext: false,
        };
      } else if (path.startsWith("/api/foods/"))
        data = { items: [], totalItems: 0, totalPages: 0, hasNext: false };
      return r.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const base = "http://127.0.0.1:5173/?demo=0#";
  const dialog = p.locator(".profile-people-dialog");
  const handle = dialog.locator(".profile-people-handle");
  const cdp = await context.newCDPSession(p);
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  async function settle() {
    await p.evaluate(async () => {
      await Promise.allSettled(document.getAnimations().map((a) => a.finished));
    });
  }
  async function geometry() {
    return dialog.evaluate((element) => {
      const box = (selector) =>
        element.querySelector(selector).getBoundingClientRect().toJSON();
      return {
        dialog: element.getBoundingClientRect().toJSON(),
        shell: box(".profile-people-shell"),
        handle: box(".profile-people-handle"),
        heading: box(".profile-people-heading"),
        footer: box(".profile-people-footer"),
        scroll: box(".profile-people-scroll"),
        height: innerHeight,
      };
    });
  }
  async function aligned() {
    await dialog.waitFor({ state: "visible" });
    await settle();
    const g = await geometry();
    assert(
      Math.abs(g.shell.y - g.dialog.y) < 2,
      "Content moved away from its background: " + JSON.stringify(g),
    );
    assert(g.heading.y - g.dialog.y < 50, "Large blank space above heading");
    assert(g.footer.bottom <= g.height + 1, "Footer clipped below viewport");
    assert(
      Math.abs(g.dialog.bottom - g.height) < 2,
      "Mobile sheet is not bottom aligned",
    );
    assert(g.scroll.height > 150, "List has too little usable height");
  }
  async function drag(delta, cancel = false) {
    const before = await geometry();
    const x = Math.round(before.handle.x + before.handle.width / 2),
      y = Math.round(before.handle.y + 14);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 10; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + (delta * i) / 10 }],
      });
    const during = await geometry();
    assert(
      during.dialog.y > before.dialog.y + delta / 2,
      "Dragging moved content instead of the whole dialog",
    );
    assert(
      Math.abs(during.shell.y - during.dialog.y) < 2,
      "Background did not follow content during drag",
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: cancel ? "touchCancel" : "touchEnd",
      touchPoints: [],
    });
  }
  async function closed() {
    await p.waitForFunction(
      () =>
        !document
          .querySelector(".profile-people-dialog")
          ?.hasAttribute("open") && !location.hash.includes("people="),
    );
    await settle();
  }
  async function reopen() {
    await p.getByRole("link", { name: /粉丝$/ }).click();
    await aligned();
  }
  try {
    for (const [width, height] of [
      [320, 740],
      [338, 726],
      [390, 844],
      [520, 844],
    ]) {
      await p.setViewportSize({ width, height });
      await p.goto(base + "/me?people=fans");
      await p
        .getByRole("heading", { name: "还没有粉丝", exact: true })
        .waitFor();
      await aligned();
      await drag(90, true);
      await aligned();
      await drag(220);
      await closed();
      await reopen();
      await dialog.getByRole("tab", { name: /关注/ }).click();
      await p
        .getByRole("heading", { name: "还没有关注的食友", exact: true })
        .waitFor();
      await aligned();
      await dialog.locator(".profile-people-close").click();
      await closed();
      await reopen();
      await drag(220);
      await closed();
      await reopen();
      if (width === 338)
        await p.screenshot({
          path: "output/playwright/people-sheet-fixed-338.png",
        });
      await p.keyboard.press("Escape");
      await closed();
      await reopen();
      checks.push(
        `${width}x${height}: aligned empty state, cancelled gesture, whole-sheet drag, repeated reopen, tabs, close button and Escape`,
      );
    }
    populated = true;
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + "/me?people=fans");
    await p.reload();
    await p
      .getByRole("link", { name: "查看食友 20的主页", exact: true })
      .waitFor();
    await aligned();
    const scrolled = await dialog
      .locator(".profile-people-scroll")
      .evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return element.scrollTop;
      });
    assert(scrolled > 0, "Long list cannot scroll");
    await aligned();
    await dialog.getByRole("textbox", { name: "搜索本页食友" }).fill("食友 20");
    await p.waitForFunction(
      () => document.querySelectorAll(".profile-people-person-row").length === 1,
    );
    assert(
      (await dialog.locator(".profile-people-person-row").count()) === 1,
      "Search did not filter list",
    );
    await drag(220);
    await closed();
    await reopen();
    assert(
      (await dialog
        .locator(".profile-people-scroll")
        .evaluate((e) => e.scrollTop)) === 0,
      "Reopened list retained stale scroll",
    );
    await p.screenshot({ path: "output/playwright/people-sheet-list-390.png" });
    checks.push(
      "Populated list: scrolling, search, drag-close and clean reopening",
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    await handle.focus();
    await p.keyboard.press("ArrowDown");
    await closed();
    await reopen();
    checks.push("Keyboard handle and reduced motion reopen correctly");
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(base + "/me?people=fans");
    await dialog.waitFor({ state: "visible" });
    await settle();
    const desktop = await geometry();
    assert(
      Math.abs(desktop.dialog.y - desktop.shell.y) < 2,
      "Desktop content shifted",
    );
    assert(
      desktop.dialog.width === 700 && desktop.dialog.height === 580,
      "Desktop sizing changed",
    );
    assert(!(await handle.isVisible()), "Mobile handle leaked onto desktop");
    checks.push("Desktop dialog retains its original layout");
    assert(errors.length === 0, errors.join("; "));
    return { checks, errors };
  } catch (error) {
    await p.screenshot({ path: "output/playwright/people-sheet-failure.png" });
    return {
      checks,
      errors,
      failure: String(error),
      url: p.url(),
      geometry: await geometry(),
    };
  } finally {
    await context.close();
  }
}
