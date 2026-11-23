async function validateCropPreview(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  for (const [width, height, photoWidth, photoHeight] of [
    [320, 520, 800, 800],
    [390, 640, 1200, 800],
    [667, 375, 800, 1200],
  ]) {
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height },
        isMobile: true,
        hasTouch: true,
        colorScheme: width === 390 ? "dark" : "light",
        reducedMotion: width === 320 ? "reduce" : "no-preference",
      });
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
        if (r.request().method() !== "GET" && path !== "/api/device/register") {
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
      await p.goto(base + "/?demo=0&view=mobile#/publish/dish");
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
      const [chooser] = await Promise.all([
        p.waitForEvent("filechooser"),
        p.getByRole("button", { name: "加一张照片", exact: true }).click(),
      ]);
      await chooser.setFiles({
        name: "crop-grid.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      });
      await p.waitForURL(/#\/publish\/crop/);
      await p.locator('img[alt="所选照片"]').waitFor();
      await p.waitForFunction(
        () => document.querySelector('img[alt="所选照片"]')?.naturalWidth > 0,
      );
      const palette = p.getByRole("radiogroup", { name: "舞台颜色" });
      const followCover = p.getByRole("button", { name: "跟随封面" });
      const done = p.getByRole("button", { name: "完成", exact: true });
      const cancel = p.getByRole("button", { name: "取消", exact: true });
      const slider = p.getByRole("slider", { name: "缩放", exact: true });
      for (const control of [
        done,
        cancel,
        palette,
        p.getByAltText("首页裁剪预览").locator(".."),
      ]) {
        const bounds = await control.boundingBox();
        assert(
          bounds &&
            bounds.x >= 0 &&
            bounds.y >= 0 &&
            bounds.x + bounds.width <= width &&
            bounds.y + bounds.height <= height,
          `${width}×${height}: ${await control.innerText()} is outside the viewport`,
        );
      }
      const cdp = await context.newCDPSession(p);
      const sendTouch = (type, touchPoints) =>
        cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
      if (width === 390) {
        await p.setViewportSize({ width, height: 720 });
        const initialDone = await done.boundingBox();
        const swipeFrom = async (control, distance) => {
          const { x, y, width, height } = await control.boundingBox();
          const start = { x: x + width / 2, y: y + height / 2 };
          await sendTouch("touchStart", [start]);
          for (let step = 1; step <= 8; step++) {
            await sendTouch("touchMove", [
              { ...start, y: start.y + (distance * step) / 8 },
            ]);
          }
          await sendTouch("touchEnd", []);
        };
        await swipeFrom(palette.getByRole("radio").first(), -104);
        await p.waitForFunction(() => window.scrollY >= 32, undefined, {
          timeout: 1500,
        });
        assert(
          (await done.boundingBox()).y === initialDone.y,
          "Done moved during the palette swipe",
        );
        assert(
          (await followCover.getAttribute("aria-pressed")) === "true",
          "Swiping selected a color",
        );
        await palette.getByRole("radio").first().check();
        await swipeFrom(followCover, 104);
        await p.waitForFunction(() => window.scrollY === 0, undefined, {
          timeout: 1500,
        });
        assert(
          (await followCover.getAttribute("aria-pressed")) === "false",
          "Swiping activated Follow Cover",
        );
        await followCover.tap();
        await p.setViewportSize({ width, height });
        checks.push(
          "390×720: vertical swipes on the color swatch and Follow Cover scroll the editor",
        );
      }
      if (width === 320) {
        await p.setViewportSize({ width, height: 300 });
        const initialDone = await done.boundingBox();
        await sendTouch("touchStart", [{ x: 8, y: 220 }]);
        for (let y = 204; y >= 60; y -= 16)
          await sendTouch("touchMove", [{ x: 8, y }]);
        await sendTouch("touchEnd", []);
        await p.waitForFunction(() => window.scrollY > 24);
        assert(
          (await done.boundingBox()).y === initialDone.y,
          "Done moved during scrolling",
        );
        assert(
          (await cancel.boundingBox()).y === initialDone.y,
          "Cancel moved during scrolling",
        );
        await p.setViewportSize({ width, height });
        await p.evaluate(() => window.scrollTo(0, 0));
        checks.push(
          "320×300: swiping beside the photo scrolls and keeps both actions visible",
        );
      }
      const geometry = () =>
        p.evaluate(() => {
          const image = document.querySelector('img[alt="所选照片"]');
          const preview = document.querySelector('img[alt="首页裁剪预览"]');
          const frame = image.parentElement.getBoundingClientRect().toJSON();
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
            scale: frame.width / 300,
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
      const initial = await compare("Initial");
      const viewportScale = await p.evaluate(() => visualViewport.scale);
      const touch = (id, dx, dy) => ({
        id,
        x: initial.frame.x + initial.frame.width / 2 + dx * initial.scale,
        y: initial.frame.y + initial.frame.height / 2 + dy * initial.scale,
      });
      await sendTouch("touchStart", [touch(1, -50, 15)]);
      await sendTouch("touchStart", [touch(1, -50, 15), touch(2, 50, 15)]);
      for (let delta = 4; delta <= 40; delta += 4) {
        await sendTouch("touchMove", [
          touch(1, -50 - delta, 15),
          touch(2, 50 + delta, 15),
        ]);
      }
      await p.waitForFunction(
        () => Number(document.querySelector('input[type="range"]').value) > 1.7,
      );
      const pinched = await compare("Pinch out");
      assert(
        Math.abs(Number(await slider.inputValue()) - 1.8) < 0.03,
        "Pinch did not track both fingers",
      );
      const anchorY = 0.55;
      assert(
        Math.abs(
          pinched.main.y +
            pinched.main.size * anchorY -
            initial.main.y -
            initial.main.size * anchorY,
        ) < 0.2,
        "The photo content moved away from the midpoint between the fingers",
      );
      for (let delta = 36; delta >= 0; delta -= 4) {
        await sendTouch("touchMove", [
          touch(1, -50 - delta, 15),
          touch(2, 50 + delta, 15),
        ]);
      }
      await sendTouch("touchEnd", []);
      await p.waitForFunction(
        () => Number(document.querySelector('input[type="range"]').value) === 1,
      );
      assert(
        (await p.evaluate(() => visualViewport.scale)) === viewportScale,
        "Pinch zoomed the page",
      );
      await p.getByRole("button", { name: "放大照片" }).tap();
      assert(
        Number(await slider.inputValue()) === 1.25,
        "Zoom in button did not work",
      );
      await p.getByRole("button", { name: "缩小照片" }).tap();
      assert(
        Number(await slider.inputValue()) === 1,
        "Zoom out button did not work",
      );
      await slider.fill("1.6");
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
      await slider.fill("1");
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
      await slider.fill("1.4");
      const beforeKeyboard = await geometry();
      await p.getByRole("group", { name: /照片取景/ }).press("ArrowLeft");
      assert(
        (await geometry()).image.x < beforeKeyboard.image.x,
        "Keyboard could not move the photo",
      );
      await palette.getByRole("radio").first().check();
      assert(
        (await followCover.getAttribute("aria-pressed")) === "false",
        "Could not choose a custom color",
      );
      await followCover.click();
      assert(
        (await followCover.getAttribute("aria-pressed")) === "true",
        "Could not restore automatic cover color",
      );
      if (width === 390) await palette.getByRole("radio").first().check();
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
      await done.click();
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
      if (width === 390) {
        await p.getByRole("button", { name: "编辑第 1 张照片" }).click();
        await p.waitForURL(/#\/publish\/crop/);
        await p.waitForFunction(
          () =>
            !document.querySelector(".mobile-crop-done")?.disabled &&
            document.querySelector('img[alt="所选照片"]')?.naturalWidth > 0,
        );
        const reopened = await compare("Reopened cover photo");
        for (const key of ["x", "y", "size"]) {
          assert(
            Math.abs(reopened.main[key] - selected.main[key]) < 0.1,
            "The saved framing was not restored",
          );
        }
        assert(
          (await followCover.getAttribute("aria-pressed")) === "false",
          "The saved color choice was not restored",
        );
        await cancel.click();
        await p.waitForURL(/#\/publish\/dish/);
        checks.push("Saved cover opens with the same framing and custom color");
      }
      checks.push(
        `${width}×${height} / ${photoWidth}×${photoHeight}: visible controls, pinch out/in, buttons, drag, keyboard, palette, matching preview and export (RGB difference ${diff.toFixed(2)})`,
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
