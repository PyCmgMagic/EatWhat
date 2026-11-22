async function validateMobileHomeOrbit(page) {
  const base = new URL(page.url()).origin,
    checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  for (const width of [320, 390, 520]) {
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width, height: 900 }, hasTouch: true });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (e) => errors.push(e.message));
    let count = 2;
    const foods = Array.from({ length: 9 }, (_, i) => ({
      id: i + 1,
      name: `第${i + 1}道菜`,
      price: 18,
      pictureUrl: i % 2 ? "/assets/noodles.jpg" : "/assets/dumplings.jpg",
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
        if (url.pathname === "/api/recommend")
          data.items = foods.slice(0, count).map((food) => ({
            id: food.id,
            name: `测试餐厅${food.id}`,
            signatureFoods: [food],
          }));
        else if (url.pathname === "/api/campus/list")
          data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
        else if (url.pathname === "/api/remote-config")
          data = { flags: {}, params: { batchSize: 9 }, maintenance: { mode: "NONE" } };
        return route.fulfill({ json: { code: 0, data } });
      },
    );
    const current = () =>
      p.locator('.mobile-home-plate[data-orbit-offset="0"]');
    const measurePlate = (el) => {
      const style = getComputedStyle(el);
      const matrix = new DOMMatrix(style.transform);
      return { x: matrix.e, y: matrix.f, duration: style.transitionDuration };
    };
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
      const selected = await current().getAttribute("data-food-id");
      assert(
        selected === String(i + 1),
        `${width}px, position ${position}: expected photo ${i + 1}, got ${selected}`,
      );
      const { x, y } = await current().evaluate(measurePlate);
      assert(x === 0 && y === 0, "Selected plate did not return to its slot");
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
            if (performance.now() - start < 450) requestAnimationFrame(sample);
            else window.__orbitDone = true;
          };
          sample();
        }, outgoing);
        await shuffle.click();
        await p.waitForFunction(() => window.__orbitDone);
        const samples = await p.evaluate(() => window.__orbitSamples);
        const spacing = await outgoing.evaluate((el) => el.offsetWidth * 1.1);
        assert(
          samples.every(
            (s) => s.connected && s.opacity === 1 && Math.abs(s.y) < 1,
          ),
          "Outgoing plate lost visibility or changed height during the slide",
        );
        assert(
          samples.some((s) => s.x < -5 && s.x > -spacing + 5),
          "No intermediate horizontal motion",
        );
        assert(
          samples.every((s, i) => !i || s.x <= samples[i - 1].x + 0.1),
          "Wrap reversed the slide direction",
        );
        await settle();
        const end = await outgoing.evaluate((el) => {
          const matrix = new DOMMatrix(getComputedStyle(el).transform);
          return { x: matrix.e, angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI };
        });
        assert(
          Math.abs(end.x + spacing) < 1 && Math.abs(end.angle + 6) < 0.1,
          `Slide did not settle with a small roll: ${JSON.stringify(end)}, spacing ${spacing}`,
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
        `${width}px: two-food wrap keeps both plates on a horizontal path; photo, title and link agree`,
      );

      // Freeze the CSS transitions to inspect the hand-off visually.
      await shuffle.click();
      await p.locator(".mobile-home-orbit").evaluate((el) =>
        el.getAnimations({ subtree: true }).forEach((a) => {
          a.pause();
          a.currentTime = 70;
        }),
      );
      await p.screenshot({
        path: `output/playwright/home-slide-mid-${width}.png`,
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
        name: "左右滑动换一道菜",
        exact: true,
      });
      const drag = async (dx) => {
        await p.mouse.move(width * 0.7, 210);
        await p.mouse.down();
        await p.mouse.move(width * 0.7 + dx, 210, { steps: 6 });
        await p.waitForFunction((distance) => {
          const el = document.querySelector('.mobile-home-plate[data-orbit-offset="0"]');
          return Math.abs(new DOMMatrix(getComputedStyle(el).transform).e - distance) < 1;
        }, dx);
        const during = await current().evaluate(measurePlate);
        assert(
          during.duration === "0s" && Math.abs(during.y) < 1,
          "Drag does not follow the pointer horizontally",
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
      await p.waitForFunction(() => {
        const el = document.querySelector('.mobile-home-plate[data-orbit-offset="0"]');
        return new DOMMatrix(getComputedStyle(el).transform).e < -59;
      });
      await group.dispatchEvent("pointercancel", { pointerId: 7 });
      await verify(13);
      checks.push(
        `${width}px: rapid switching, both drag directions, small-drag snap-back and cancellation`,
      );

      if (width === 390) {
        const touch = await context.newCDPSession(p);
        const swipe = async (dx, dy) => {
          const start = { x: 275, y: 265 };
          await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
          for (let step = 1; step <= 8; step++) {
            await touch.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ x: start.x + dx * step / 8, y: start.y + dy * step / 8 }],
            });
          }
          await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        };
        await swipe(-80, 8);
        await verify(14);
        await swipe(80, 8);
        await verify(13);
        await swipe(-35, -160);
        await p.waitForFunction(() => scrollY > 40);
        await verify(13);
        await p.evaluate(() => scrollTo(0, 0));
        checks.push("390px touch: swipes switch both ways, vertical drag scrolls the page");
      }

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
