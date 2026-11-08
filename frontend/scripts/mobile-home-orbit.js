async function validateMobileHomeOrbit(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  for (const width of [320, 390, 520]) {
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width, height: 900 } });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (e) => errors.push(e.message));
    let count = 2;
    const foods = Array.from({ length: 9 }, (_, i) => ({
      id: i + 1,
      name: `第${i + 1}道菜`,
      category: "staple",
      price: 18,
      restaurantId: 1,
      restaurantName: "测试餐厅",
      pictureUrl: [
        base +
          (i % 2
            ? "/prototype/assets/dishes/yuntun.svg"
            : "/assets/dumplings.jpg"),
      ],
    }));
    await context.route(
      () => true,
      (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== base) return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        assert(req.method() === "GET", "Unexpected write: " + url.pathname);
        let data = { items: [], totalItems: 0, totalPages: 0, hasNext: false };
        if (url.pathname === "/api/foods/recommend")
          data = foods.slice(0, count);
        else if (url.pathname === "/api/campus/list")
          data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
        else if (url.pathname === "/api/remote-config")
          data = { flags: {}, params: {}, maintenance: { mode: "NONE" } };
        return route.fulfill({ json: { code: 0, data } });
      },
    );
    const current = () =>
      p.locator('.mobile-home-plate[data-orbit-offset="0"]');
    const shuffle = p.getByRole("button", { name: "换一个", exact: true });
    const settle = () =>
      p.evaluate(async () => {
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        await Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => {})),
        );
      });
    const verify = async (position) => {
      await settle();
      const i = ((position % count) + count) % count;
      assert(
        (await current().getAttribute("data-food-id")) === String(i + 1),
        "Incorrect selected photo",
      );
      assert(
        (await p.locator(".mobile-home-copy h1").innerText()) === foods[i].name,
        "Photo/title mismatch",
      );
      const href = await p
        .getByRole("link", { name: "就它了", exact: true })
        .getAttribute("href");
      assert(href?.endsWith(`/foods/${i + 1}`), "Photo/link mismatch: " + href);
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Horizontal overflow",
      );
    };
    try {
      await p.goto(base + "/?demo=0&view=mobile#/");
      await current().waitFor();
      await verify(0);
      await p
        .locator(".mobile-home-plate > img")
        .evaluateAll((nodes) => Promise.all(nodes.map((img) => img.decode())));
      for (let step = 1; step <= 4; step++) {
        const outgoing = await current().elementHandle();
        const incoming = await p
          .locator('.mobile-home-plate[data-orbit-offset="1"]')
          .elementHandle();
        await p.evaluate((el) => {
          window.__orbitSamples = [];
          window.__orbitDone = false;
          const start = performance.now();
          const sample = () => {
            const style = getComputedStyle(el),
              m = new DOMMatrix(style.transform);
            window.__orbitSamples.push({
              angle: (Math.atan2(m.b, m.a) * 180) / Math.PI,
              x: m.e,
              y: m.f,
              opacity: +style.opacity,
              connected: el.isConnected,
            });
            if (performance.now() - start < 650) requestAnimationFrame(sample);
            else window.__orbitDone = true;
          };
          sample();
        }, outgoing);
        await shuffle.click();
        await p.waitForFunction(() => window.__orbitDone);
        const samples = await p.evaluate(() => window.__orbitSamples);
        assert(
          samples.every(
            (s) => s.connected && (s.angle <= -50 || s.opacity > 0.95),
          ),
          "Outgoing plate disappeared before leaving its arc",
        );
        assert(
          samples.some((s) => s.angle < -5 && s.angle > -50),
          "No intermediate circular motion",
        );
        assert(
          samples.every((s, i) => !i || s.angle <= samples[i - 1].angle + 0.1),
          "Wrap reversed the orbit direction",
        );
        assert(
          Math.abs(samples.at(-1).angle + 55) < 0.1,
          "Orbit did not settle",
        );
        // The path must stay circular, rather than linearly interpolating two matrices.
        const radius = await outgoing.evaluate(
          (el) => el.offsetWidth * 1.34375,
        );
        assert(
          samples.every(
            (s) =>
              Math.abs(
                Math.hypot(
                  s.x - radius * Math.sin((55 * Math.PI) / 180),
                  s.y - radius * Math.cos((55 * Math.PI) / 180),
                ) - radius,
              ) < 1,
          ),
          "Plate moved along a chord instead of an arc",
        );
        assert(
          await incoming.evaluate(
            (el) => el.isConnected && el.dataset.orbitOffset === "0",
          ),
          "Incoming photo was replaced during selection",
        );
        await verify(step);
      }
      checks.push(
        `${width}px: two-food wrap keeps both plates on a continuous arc; photo, title and link agree`,
      );

      // Freeze actual CSS transitions to inspect the circular hand-off visually.
      await shuffle.click();
      await p.locator(".mobile-home-orbit").evaluate((el) =>
        el.getAnimations({ subtree: true }).forEach((a) => {
          a.pause();
          a.currentTime = 70;
        }),
      );
      await p.screenshot({
        path: `../output/playwright/home-orbit-mid-${width}.png`,
      });
      await p
        .locator(".mobile-home-orbit")
        .evaluate((el) =>
          el.getAnimations({ subtree: true }).forEach((a) => a.finish()),
        );
      await verify(5);
      for (let i = 0; i < 8; i++) {
        await shuffle.click();
      }
      await verify(13);

      const group = p.getByRole("group", {
        name: "转盘，左右滑动换一道菜",
        exact: true,
      });
      const drag = async (dx) => {
        await p.mouse.move(width * 0.7, 210);
        await p.mouse.down();
        await p.mouse.move(width * 0.7 + dx, 210, { steps: 6 });
        const during = await current().evaluate((el) => ({
          angle: Math.atan2(
            new DOMMatrix(getComputedStyle(el).transform).b,
            new DOMMatrix(getComputedStyle(el).transform).a,
          ),
          duration: getComputedStyle(el).transitionDuration,
        }));
        assert(
          during.duration === "0s" && during.angle * dx > 0,
          "Drag does not follow pointer immediately",
        );
        assert(
          await p
            .locator(
              `.mobile-home-plate[data-orbit-offset="${dx < 0 ? 1 : -1}"]`,
            )
            .evaluate((el) => getComputedStyle(el).opacity === "1"),
          "Adjacent plate did not appear during drag",
        );
        await p.mouse.up();
      };
      await drag(-60);
      await verify(14);
      await drag(60);
      await verify(13);
      await drag(8);
      await verify(13);
      await group.dispatchEvent("pointerdown", { pointerId: 7, clientX: 220 });
      await group.dispatchEvent("pointermove", { pointerId: 7, clientX: 160 });
      await group.dispatchEvent("pointercancel", { pointerId: 7 });
      await verify(13);
      checks.push(
        `${width}px: rapid switching, both drag directions, small-drag snap-back and cancellation`,
      );

      await shuffle.focus();
      await p.keyboard.press("Enter");
      await verify(14);
      assert(
        await current().evaluate(
          (el) => getComputedStyle(el).transitionDuration === "0s",
        ),
        "Keyboard navigation animated",
      );
      await p.emulateMedia({ reducedMotion: "reduce" });
      await shuffle.click();
      await verify(15);
      assert(
        await current().evaluate(
          (el) => getComputedStyle(el).transitionDuration === "0s",
        ),
        "Reduced motion ignored",
      );
      await p.emulateMedia({ reducedMotion: "no-preference" });
      checks.push(
        `${width}px: keyboard and reduced-motion switches are immediate`,
      );

      count = 9;
      await p.reload();
      await current().waitFor();
      await verify(0);
      for (let i = 1; i <= 10; i++) {
        await shuffle.click();
        await verify(i);
      }
      assert(
        (await p.locator(".mobile-home-plate").count()) === 5,
        "Unbounded orbit DOM",
      );
      count = 1;
      await p.reload();
      await current().waitFor();
      await verify(0);
      assert(await shuffle.isDisabled(), "Single recommendation still spins");
      assert(
        (await p.locator(".mobile-home-plate").count()) === 1,
        "Single recommendation duplicated",
      );
      count = 0;
      await p.reload();
      await p.getByRole("heading", { name: /今天.*吃点什么/ }).waitFor();
      assert(
        (await p.locator(".mobile-home-plate").count()) === 0,
        "Empty recommendations keep old photos",
      );
      checks.push(
        `${width}px: nine-food loop, single recommendation and empty state`,
      );
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, errors.join("\n"));
  return { checks, errors };
}
