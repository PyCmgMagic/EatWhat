async function validateCropPreview(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  for (const [width, photoWidth, photoHeight] of [
    [320, 800, 800],
    [390, 1200, 800],
    [520, 800, 1200],
  ]) {
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width, height: 844 } });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (e) => errors.push(e.message));
    await context.addInitScript(() => {
      if (location.hostname !== "127.0.0.1") return;
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-session",
          tokenValue: "isolated-crop-preview",
        }),
      );
      window.__cropFiles = new Map();
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = create(blob);
        window.__cropFiles.set(url, blob);
        return url;
      };
    });
    await context.route(
      (u) => u.origin !== base,
      (r) => r.abort(),
    );
    await context.route(
      (u) => u.pathname.startsWith("/api/"),
      (r) => {
        const path = new URL(r.request().url()).pathname;
        if (r.request().method() !== "GET") {
          errors.push("Unexpected mutation: " + path);
          return r.abort();
        }
        let data = [];
        if (path === "/api/user/info")
          data = {
            id: 10,
            displayName: "裁剪测试",
            verified: true,
            banned: false,
          };
        else if (path.startsWith("/api/restaurant/detail/"))
          data = { id: 1, name: "测试食堂", address: "校园" };
        else if (path === "/api/remote-config")
          data = {
            configVersion: 1,
            flags: {},
            params: {},
            maintenance: { mode: "NONE" },
            announcements: [],
            versions: {},
          };
        else if (path === "/api/campus/list")
          data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
        else if (path === "/api/notification/unread/count") data = 0;
        return r.fulfill({ status: 200, json: { code: 0, data } });
      },
    );
    try {
      await p.goto(base + "/?demo=0#/publish/dish");
      const png = await p.evaluate(
        ({ w, h }) => {
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          const colors = ["#f4ad62", "#74a8d2", "#9ec37d", "#d88293"];
          for (let y = 0; y < 4; y++)
            for (let x = 0; x < 4; x++) {
              ctx.fillStyle = colors[(x + y) % 4];
              ctx.fillRect((x * w) / 4, (y * h) / 4, w / 4, h / 4);
              ctx.fillStyle = "#231c18";
              ctx.font = "bold 65px sans-serif";
              ctx.fillText(
                String(y * 4 + x + 1),
                (x * w) / 4 + 20,
                (y * h) / 4 + 80,
              );
            }
          return canvas.toDataURL("image/png").split(",")[1];
        },
        { w: photoWidth, h: photoHeight },
      );
      const chooser = p.waitForEvent("filechooser");
      await p
        .getByRole("button", { name: "再加一张照片", exact: true })
        .click();
      await (
        await chooser
      ).setFiles({
        name: "crop-grid.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      });
      await p.waitForURL(/#\/publish\/crop/);
      await p.locator('img[alt="所选照片"]').waitFor();
      await p.waitForFunction(
        () => document.querySelector('img[alt="所选照片"]')?.naturalWidth > 0,
      );
      const geometry = () =>
        p.evaluate(() => {
          const image = document.querySelector('img[alt="所选照片"]');
          const preview = document.querySelector('img[alt="首页裁剪预览"]');
          const stage = image.parentElement.getBoundingClientRect(),
            scale = stage.width / 390;
          const frame = {
            x: stage.x + 45 * scale,
            y: stage.y + 50 * scale,
            width: 300 * scale,
          };
          const thumb = preview.parentElement.getBoundingClientRect();
          const crop = (img, frame) => {
            const b = img.getBoundingClientRect();
            return {
              x: ((frame.x - b.x) / b.width) * img.naturalWidth,
              y: ((frame.y - b.y) / b.height) * img.naturalHeight,
              size: (frame.width / b.width) * img.naturalWidth,
            };
          };
          return {
            main: crop(image, frame),
            preview: crop(preview, thumb),
            scale,
            image: image.getBoundingClientRect().toJSON(),
            frame,
          };
        });
      const compare = async (label) => {
        const g = await geometry();
        for (const key of ["x", "y", "size"])
          assert(
            Math.abs(g.main[key] - g.preview[key]) < 0.1,
            label + ": preview differs from crop: " + JSON.stringify(g),
          );
        assert(
          g.main.x >= -0.1 &&
            g.main.y >= -0.1 &&
            g.main.x + g.main.size <= photoWidth + 0.1 &&
            g.main.y + g.main.size <= photoHeight + 0.1,
          label + ": blank area exposed",
        );
        return g;
      };
      await compare("Initial");
      await p.getByRole("slider", { name: "缩放", exact: true }).fill("1.6");
      const before = await compare("Zoomed");
      const cx = before.frame.x + before.frame.width / 2,
        cy = before.frame.y + before.frame.width / 2;
      await p.mouse.move(cx, cy);
      await p.mouse.down();
      await p.mouse.move(cx + 25 * before.scale, cy - 18 * before.scale, {
        steps: 8,
      });
      await p.mouse.up();
      const after = await compare("Dragged");
      assert(
        Math.abs(after.image.x - before.image.x - 25 * before.scale) < 1,
        "Drag does not track the finger at " + width,
      );
      assert(
        Math.abs(after.image.y - before.image.y + 18 * before.scale) < 1,
        "Vertical drag does not track the finger",
      );
      await p.getByRole("slider", { name: "缩放", exact: true }).fill("1");
      await compare("Zoom reset");
      // Exercise an edge pan with the original landscape/portrait still available.
      const middle = await geometry();
      await p.mouse.move(cx, cy);
      await p.mouse.down();
      await p.mouse.move(cx + 140 * middle.scale, cy + 140 * middle.scale, {
        steps: 8,
      });
      await p.mouse.up();
      const edge = await compare("Edge pan");
      assert(
        Math.abs(edge.main.x) < 0.1 && Math.abs(edge.main.y) < 0.1,
        "Cannot select the first corner of a rectangular original",
      );
      await p.getByRole("slider", { name: "缩放", exact: true }).fill("1.4");
      const selected = await compare("Final");
      const expected = await p.evaluate((source) => {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const ctx = c.getContext("2d");
        ctx.drawImage(
          document.querySelector('img[alt="所选照片"]'),
          source.x,
          source.y,
          source.size,
          source.size,
          0,
          0,
          64,
          64,
        );
        return Array.from(ctx.getImageData(0, 0, 64, 64).data);
      }, selected.main);
      await p.screenshot({
        path: `output/playwright/crop-preview-${width}.png`,
        fullPage: true,
      });
      await p.getByRole("link", { name: "完成", exact: true }).click();
      await p.waitForURL(/#\/publish\/dish/);
      const diff = await p.evaluate(async (expected) => {
        const file = [...window.__cropFiles.values()].findLast((f) =>
          f.name?.endsWith("-cropped.jpg"),
        );
        if (!file) throw new Error("No cropped image saved");
        const bitmap = await createImageBitmap(file);
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const ctx = c.getContext("2d");
        ctx.drawImage(bitmap, 0, 0, 64, 64);
        const actual = ctx.getImageData(0, 0, 64, 64).data;
        let total = 0,
          count = 0;
        for (let i = 0; i < actual.length; i++)
          if (i % 4 !== 3) {
            total += Math.abs(actual[i] - expected[i]);
            count++;
          }
        bitmap.close();
        return total / count;
      }, expected);
      assert(
        diff < 5,
        "Saved crop differs from the visible selection: average RGB difference " +
          diff,
      );
      checks.push(
        `${width}px / ${photoWidth}×${photoHeight}: initial, zoom, pan, edges, thumbnail match; saved image pixel difference ${diff.toFixed(2)}`,
      );
    } catch (error) {
      await p.screenshot({
        path: "output/playwright/crop-preview-failure.png",
        fullPage: true,
      });
      throw new Error(
        String(error) + "\n" + (await p.locator("body").innerText()),
      );
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, errors.join("; "));
  return { checks, errors, realBackendRequests: 0 };
}
