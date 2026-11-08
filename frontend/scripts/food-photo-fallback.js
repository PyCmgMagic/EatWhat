async function validateFoodPhotoFallback(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  for (const width of [320, 390, 520, 1440]) {
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 960 },
        reducedMotion: "reduce",
      });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (e) => errors.push(e.message));
    const foods = [
      { id: 1, name: "未拍照的炒饭", category: "staple", pictureUrl: [] },
      {
        id: 2,
        name: "失效图片的点心",
        category: "snack",
        pictureUrl: [base + "/qa/broken.jpg"],
      },
      {
        id: 3,
        name: "有实拍的饺子",
        category: "snack",
        pictureUrl: [base + "/assets/dumplings.jpg"],
      },
      { id: 4, name: "没有图片的饮品", category: "drink", pictureUrl: null },
      { id: 5, name: "没有分类的菜", pictureUrl: [""] },
    ].map((f) => ({
      ...f,
      restaurantId: 1,
      restaurantName: "测试餐厅",
      price: 18,
      likesCount: 0,
    }));
    let reads = 0,
      missingArtwork = false;
    await context.route(
      () => true,
      (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== base) return route.abort();
        if (url.pathname === "/qa/broken.jpg") return route.abort();
        if (missingArtwork && url.pathname.endsWith("/danchaofan.svg"))
          return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        assert(req.method() === "GET", "Unexpected write: " + url.pathname);
        let data = { items: [], totalItems: 0, totalPages: 0, hasNext: false };
        if (url.pathname.startsWith("/api/foods/")) reads++;
        if (url.pathname === "/api/foods/recommend") data = foods;
        else if (url.pathname === "/api/foods/list")
          data = {
            items: foods,
            totalItems: foods.length,
            totalPages: 1,
            currentPage: 1,
            hasNext: false,
          };
        else if (url.pathname === "/api/campus/list")
          data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
        else if (url.pathname === "/api/remote-config")
          data = { flags: {}, params: {}, maintenance: { mode: "NONE" } };
        return route.fulfill({ json: { code: 0, data } });
      },
    );
    try {
      await p.goto(base + "/?demo=0#/search");
      await p.locator(".ew-food-card").first().waitFor();
      const photo = p
        .locator(".ew-food-card")
        .filter({
          has: p.getByRole("heading", { name: "有实拍的饺子", exact: true }),
        });
      await photo.locator(".ew-food-photo > img").evaluate((el) => el.decode());
      const failed = p
        .locator(".ew-food-card")
        .filter({
          has: p.getByRole("heading", { name: "失效图片的点心", exact: true }),
        });
      await failed
        .getByRole("img", {
          name: "菜品图片加载失败，插画仅作示意",
          exact: true,
        })
        .waitFor();
      assert(
        (await photo.locator(".food-photo-fallback").count()) === 0,
        "Real photo received placeholder label",
      );
      const fallbacks = p.locator(".ew-food-photo > .food-photo-fallback");
      assert((await fallbacks.count()) === 4, "Missing catalog fallback");
      await fallbacks
        .first()
        .locator(".dish-illustration > img")
        .evaluate((el) => el.decode());
      const bounds = await fallbacks.evaluateAll((nodes) =>
        nodes.map((el) => {
          const frame = el.parentElement.getBoundingClientRect(),
            label = el
              .querySelector(".food-photo-fallback-label")
              .getBoundingClientRect(),
            image = el.querySelector(".dish-illustration > img"),
            art = image.getBoundingClientRect();
          return {
            labelInFrame:
              label.left >= frame.left &&
              label.right <= frame.right &&
              label.top >= frame.top &&
              label.bottom <= frame.bottom,
            artInFrame:
              art.left >= frame.left &&
              art.right <= frame.right &&
              art.top >= frame.top &&
              art.bottom <= label.top,
            artWidth: art.width,
            fit: getComputedStyle(image).objectFit,
          };
        }),
      );
      assert(
        bounds.every(
          (b) =>
            b.labelInFrame &&
            b.artInFrame &&
            b.artWidth > 20 &&
            b.fit === "contain",
        ),
        JSON.stringify(bounds),
      );
      assert(
        !(await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )),
        "Horizontal overflow",
      );
      await p.screenshot({
        path: `../output/playwright/food-fallback-catalog-${width}.png`,
        fullPage: true,
      });
      checks.push(
        `${width}px catalog: labeled missing/broken images, real photos unchanged, category art and labels fit`,
      );
      assert(reads <= 4, "Repeated data refresh loop");

      await p.goto(base + "/?demo=0#/");
      // Desktop layout uses the same card component for home and profile shares.
      const cards = p.locator(
        width < 600 ? ".design-food-tile" : ".pc-food-card",
      );
      await cards.first().locator(".food-photo-fallback").waitFor();
      await cards
        .nth(1)
        .getByRole("img", {
          name: "菜品图片加载失败，插画仅作示意",
          exact: true,
        })
        .waitFor();
      assert(
        await cards.first().getByText("暂无实拍", { exact: true }).isVisible(),
        "Home fallback is unlabeled",
      );
      assert(
        await cards.first().getByText("示意图", { exact: true }).isVisible(),
        "Home illustration disclosure missing",
      );
      await p.screenshot({
        path: `../output/playwright/food-fallback-home-${width}.png`,
        fullPage: true,
      });
      checks.push(
        `${width}px home: shared cards display both labeled fallback states`,
      );

      missingArtwork = true;
      await p.goto(base + "/?demo=0#/search");
      await p.reload();
      await p
        .locator(".ew-food-card")
        .first()
        .locator(".dish-illustration > svg")
        .waitFor();
      assert(
        await p
          .locator(".ew-food-card")
          .first()
          .getByText("暂无实拍", { exact: true })
          .isVisible(),
        "Artwork error removed disclosure",
      );
      checks.push(
        `${width}px: missing SVG still renders the inline bowl and disclosure`,
      );
    } catch (e) {
      await p.screenshot({
        path: `../output/playwright/food-fallback-failure-${width}.png`,
        fullPage: true,
      });
      throw Error(
        `${width}px: ${e.message}; ${p.url()}; page errors: ${errors.join("; ")}`,
      );
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, errors.join("; "));
  return { checks, errors, realBackendRequests: 0 };
}
