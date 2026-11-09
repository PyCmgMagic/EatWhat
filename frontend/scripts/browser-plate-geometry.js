async (page) => {
  const browser = page.context().browser();
  const engine = browser.browserType().name();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const p = await context.newPage();
  const measurements = [];
  await context.route(
    (url) => url.origin !== "http://127.0.0.1:5173",
    (route) => route.abort(),
  );
  try {
    const base = "http://127.0.0.1:5173/?demo=1&view=desktop#/";
    await p.goto(base);
    await p.locator(".pc-food-card").first().waitFor();
    // Exercise real Plate components with raster images of different ratios.
    const photoState = await p.evaluate(() => {
      const key = "eatwhat-demo-prototype-v3";
      const state = JSON.parse(localStorage.getItem(key));
      const sizes = [[300, 600], [600, 300], [400, 400], [320, 800]];
      state.foods.forEach((food, i) => {
        const [width, height] = sizes[i % sizes.length];
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = ["#9DBF7A", "#F3C46E", "#9DB8D9", "#D8B27A"][i % 4];
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#231C18";
        ctx.font = "32px sans-serif";
        ctx.fillText(`${width} × ${height}`, 20, 60);
        food.pictureUrl = [canvas.toDataURL("image/png")];
        food.pictureKeys = food.pictureUrl;
      });
      return JSON.stringify(state);
    });
    // Seed at document startup so pending demo saves cannot overwrite the fixtures.
    await p.addInitScript((state) => {
      localStorage.setItem("eatwhat-demo-prototype-v3", state);
    }, photoState);
    await p.reload();
    await p.locator(".pc-food-card .pc-plate.is-photo img").first().waitFor({ state: "attached" });
    // Include both initial layout and resizing through responsive breakpoints.
    for (const width of [1440, 1024, 800, 1920, 1440]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.mouse.move(0, 0);
      await p.locator(".pc-food-grid").scrollIntoViewIfNeeded();
      await p.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.querySelectorAll(".pc-plate > img")].map((img) => {
          img.loading = "eager";
          return img.decode();
        }));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const result = await p.evaluate(() => ({
        viewport: innerWidth,
        plates: [...document.querySelectorAll(".pc-plate.is-photo")].map((plate) => {
          const img = plate.querySelector("img");
          const style = getComputedStyle(plate);
          return {
            source: `${img.naturalWidth}x${img.naturalHeight}`,
            width: plate.offsetWidth,
            height: plate.offsetHeight,
            fills: Math.abs(img.offsetWidth - plate.clientWidth) < 1 &&
              Math.abs(img.offsetHeight - plate.clientHeight) < 1,
            radius: style.borderRadius,
            fit: getComputedStyle(img).objectFit,
          };
        }),
      }));
      measurements.push(result);
      if (new Set(result.plates.map((plate) => plate.source)).size !== 4)
        throw Error("Expected all four image aspect ratios to be loaded");
      const invalid = result.plates.filter((plate) =>
        Math.abs(plate.width - plate.height) > 1 || !plate.fills ||
        plate.radius !== "50%" || plate.fit !== "cover",
      );
      if (invalid.length) {
        await p.screenshot({ path: `output/playwright/plate-geometry-${engine}-failure.png` });
        throw Error(JSON.stringify({ engine, viewport: width, invalid }));
      }
    }
    await p.screenshot({ path: `output/playwright/plate-geometry-${engine}.png` });
    const href = await p.locator(".pc-food-card").first().getAttribute("href");
    await p.goto(new URL(href, base).href);
    await p.locator(".pc-dish-plate > .pc-plate.is-photo img").waitFor();
    const detail = await p.locator(".pc-dish-plate > .pc-plate").evaluate(async (plate) => {
      const img = plate.querySelector("img");
      await img.decode();
      return {
        width: plate.offsetWidth,
        height: plate.offsetHeight,
        fills: img.offsetWidth === plate.clientWidth && img.offsetHeight === plate.clientHeight,
      };
    });
    if (Math.abs(detail.width - detail.height) > 1 || !detail.fills)
      throw Error(`Detail plate is not square: ${JSON.stringify(detail)}`);
    return {
      engine,
      measurements: measurements.map(({ viewport, plates }) => ({
        viewport,
        checked: plates.length,
        sources: [...new Set(plates.map((plate) => plate.source))],
        diameters: [...new Set(plates.map((plate) => plate.width))],
      })),
      detail,
    };
  } catch (error) {
    const diagnostics = await p.evaluate(() => ({
      url: location.href,
      cards: document.querySelectorAll(".pc-food-card").length,
      plates: [...document.querySelectorAll(".pc-plate")].slice(-4).map((plate) => ({
        className: plate.className,
        width: plate.offsetWidth,
        height: plate.offsetHeight,
        src: plate.querySelector("img")?.getAttribute("src")?.slice(0, 70),
      })),
      text: document.querySelector("main")?.textContent?.slice(-1000),
    }));
    throw Error(`${error}\n${JSON.stringify(diagnostics)}`);
  } finally {
    await context.close();
  }
}
