async function validateProfileAvatarEdit(
  page,
  { width = 390, height = 844, view = "mobile" } = {},
) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("请在本地开发页面运行");
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width, height },
      isMobile: view === "mobile",
      hasTouch: view === "mobile",
      reducedMotion: "reduce",
    });
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  const failures = [],
    checks = [],
    errors = [],
    writes = [],
    uploads = [];
  const user = {
    id: 10,
    displayName: "头像测试",
    signature: "认真吃饭",
    verified: true,
    banned: false,
    role: "user",
  };
  const check = (ok, message) => {
    if (!ok) failures.push(message);
    else checks.push(message);
  };
  p.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript(() =>
    localStorage.setItem(
      "eatwhat-session",
      JSON.stringify({
        tokenName: "x-session",
        tokenValue: "isolated-avatar-check",
      }),
    ),
  );
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (url.origin !== base) return route.abort();
    if (path === "/mock-avatar-upload") {
      uploads.push(request.postDataBuffer());
      return route.fulfill({ status: 200, body: "" });
    }
    if (!path.startsWith("/api/")) return route.continue();
    let data = [];
    if (path === "/api/user/info") data = user;
    else if (path === "/api/user/userInfo")
      data = {
        ...user,
        earnedLikes: 0,
        fansCount: 0,
        followingsCount: 0,
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
    else if (path === "/api/device/register") data = null;
    else if (path === "/api/user/activity")
      data = { firstUseToday: false, experienceAdded: 0 };
    else if (path === "/api/upload/presign")
      data = {
        key: "avatar/test-cropped.jpg",
        putUrl: base + "/mock-avatar-upload",
      };
    else if (path === "/api/upload/complete")
      data = { key: "avatar/test-cropped.jpg" };
    else if (path === "/api/user/updateInfo") {
      writes.push(request.postDataJSON());
      Object.assign(user, request.postDataJSON());
      data = null;
    } else if (request.method() !== "GET") {
      errors.push("Unexpected write: " + path);
      return route.abort();
    }
    return route.fulfill({ status: 200, json: { code: 0, data } });
  });
  try {
    await p.goto(base + `/?demo=0&view=${view}#/me/edit`);
    await p.locator("#sign").waitFor();
    check(
      (await p.locator("#sign").getAttribute("maxlength")) === "100",
      "Signature input allows 100 characters",
    );
    await p.locator("#sign").fill("签".repeat(100));
    check(
      (await p.locator("#sign").inputValue()).length === 100,
      "100-character signature is preserved",
    );
    const png = await p.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f3c46e";
      ctx.fillRect(0, 0, 1200, 800);
      ctx.fillStyle = "#a8321c";
      ctx.fillRect(0, 0, 400, 800);
      ctx.fillStyle = "#4f7958";
      ctx.fillRect(800, 0, 400, 800);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const file = {
      name: "avatar-test.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    };
    async function selectAvatar() {
      if (view === "mobile") {
        await p.locator(".mobile-profile-avatar-button").click();
        await p
          .getByRole("dialog", { name: "更换头像", exact: true })
          .waitFor();
        const chooser = p.waitForEvent("filechooser");
        await p.getByRole("button", { name: "从相册选", exact: true }).click();
        await (await chooser).setFiles(file);
      } else
        await p.getByLabel("上传头像", { exact: true }).setInputFiles(file);
      await p.getByRole("dialog", { name: "调整头像", exact: true }).waitFor();
      await p.waitForFunction(
        () =>
          document.querySelector('img[alt="待裁剪的头像"]')?.naturalWidth > 0,
      );
    }
    await selectAvatar();
    const cropDialog = p.getByRole("dialog", { name: "调整头像", exact: true });
    await cropDialog.waitFor();
    await p.waitForFunction(
      () => document.querySelector('img[alt="待裁剪的头像"]')?.naturalWidth > 0,
    );
    const layout = await cropDialog.evaluate((dialog) => {
      const image = dialog.querySelector(".pc-crop-frame img"),
        frame = dialog.querySelector(".pc-crop-frame"),
        zoom = dialog.querySelector('input[type="range"]'),
        apply = [...dialog.querySelectorAll("button")].find((button) =>
          button.textContent.includes("使用这个头像"),
        );
      const box = (el) => el.getBoundingClientRect().toJSON();
      return {
        dialog: box(dialog),
        frame: box(frame),
        zoom: box(zoom),
        apply: box(apply),
        image: box(image),
        imagePosition: getComputedStyle(image).position,
        touchAction: getComputedStyle(frame).touchAction,
        transform: image.style.transform,
        width: innerWidth,
        height: innerHeight,
      };
    });
    check(
      layout.image.x <= layout.frame.x + 2 &&
        layout.image.y <= layout.frame.y + 2 &&
        layout.image.right >= layout.frame.right - 2 &&
        layout.image.bottom >= layout.frame.bottom - 2,
      "Avatar preview completely covers the crop frame",
    );
    check(
      layout.frame.x >= 0 &&
        layout.frame.right <= layout.width &&
        layout.zoom.right <= layout.width &&
        layout.apply.right <= layout.width,
      "Crop frame, zoom and apply controls fit the mobile screen",
    );
    check(layout.touchAction === "none", "Crop frame owns touch dragging");
    await p.screenshot({
      path: `output/playwright/profile-avatar-crop-${width}.png`,
      fullPage: true,
    });
    const zoom = p.getByRole("slider", { name: "缩放", exact: false });
    const smaller = cropDialog.getByRole("button", { name: "缩小头像" });
    const larger = cropDialog.getByRole("button", { name: "放大头像" });
    check(await smaller.isDisabled(), "Minimum zoom disables the minus button");
    await larger.click();
    check((await zoom.inputValue()) === "1.25", "Zoom in without dragging");
    await smaller.click();
    check((await zoom.inputValue()) === "1", "Zoom out without dragging");
    if (view === "mobile") {
      await zoom.scrollIntoViewIfNeeded();
      const box = await zoom.boundingBox();
      check(
        box.x >= 64 && width - box.x - box.width >= 64 && box.height >= 44,
        "Zoom slider has a finger-sized target clear of both screen edges",
      );
      const url = p.url();
      const y = box.y + box.height / 2;
      const cdp = await context.newCDPSession(p);
      try {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart", touchPoints: [{ x: box.x + 8, y }],
        });
        for (const fraction of [0.2, 0.4, 0.6]) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove", touchPoints: [{ x: box.x + box.width * fraction, y }],
          });
        }
        const enlarged = Number(await zoom.inputValue());
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove", touchPoints: [{ x: box.x + box.width * 0.3, y }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        check(Number(await zoom.inputValue()) < enlarged, "Dragging back reduces zoom");
      } finally {
        await cdp.detach();
      }
      check(
        Number(await zoom.inputValue()) > 1 && p.url() === url && (await cropDialog.isVisible()),
        "Touch-drag zooms the avatar and keeps the editor open",
      );
    }
    if (layout.zoom.x >= 0 && layout.zoom.right <= layout.width) {
      await zoom.focus();
      for (let i = 0; i < 10; i++) await p.keyboard.press("ArrowRight");
      check(
        Number(await zoom.inputValue()) > 1,
        "Avatar zoom changes the crop",
      );
    }
    const frame = cropDialog.getByRole("group", {
      name: "照片取景，拖动或使用方向键调整",
      exact: true,
    });
    const beforeDrag = await frame.locator("img").getAttribute("style");
    const bounds = await frame.boundingBox();
    const x = bounds.x + bounds.width / 2,
      y = bounds.y + bounds.height / 2;
    if (view === "mobile") {
      const cdp = await context.newCDPSession(p);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + 40, y: y + 20 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
    } else {
      await p.mouse.move(x, y);
      await p.mouse.down();
      await p.mouse.move(x + 40, y + 20, { steps: 4 });
      await p.mouse.up();
    }
    check(
      (await frame.locator("img").getAttribute("style")) !== beforeDrag,
      "Dragging moves the avatar crop",
    );
    await cropDialog.getByRole("button", { name: "取消", exact: true }).click();
    await cropDialog.waitFor({ state: "detached" });
    if (view === "mobile") {
      await p
        .getByRole("dialog", { name: "更换头像", exact: true })
        .locator("header")
        .getByRole("button", { name: "关闭头像选项", exact: true })
        .click();
      await p
        .getByRole("dialog", { name: "更换头像", exact: true })
        .waitFor({ state: "detached" });
    }
    check(writes.length === 0, "Cancelling crop leaves the profile unchanged");
    await selectAvatar();
    await cropDialog
      .getByRole("button", { name: "使用这个头像", exact: true })
      .click();
    await cropDialog.waitFor({ state: "detached" });
    if (view === "mobile")
      await p
        .getByRole("dialog", { name: "更换头像", exact: true })
        .waitFor({ state: "detached" });
    await p
      .getByRole("button", {
        name: view === "mobile" ? "保存" : "保存修改",
        exact: true,
      })
      .click();
    if (view === "mobile") await p.waitForURL((url) => url.hash === "#/me");
    else
      await p
        .getByText("修改已保存，个人主页已同步更新。", { exact: true })
        .waitFor();
    check(
      writes.some((body) => body.signature?.length === 100),
      "Profile save accepts a 100-character signature",
    );
    check(
      uploads.length === 1 &&
        writes.some((body) => body.avatar === "avatar/test-cropped.jpg"),
      "Cropped avatar is uploaded and saved once",
    );
    if (uploads.length) {
      const dimensions = await p.evaluate(
        async (bytes) => {
          const bitmap = await createImageBitmap(
            new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
          );
          const result = { width: bitmap.width, height: bitmap.height };
          bitmap.close();
          return result;
        },
        [...uploads[0]],
      );
      check(
        dimensions.width === 768 && dimensions.height === 768,
        "Saved avatar is a cropped 768px square",
      );
    }
    check(errors.length === 0, "No browser errors: " + errors.join("; "));
    return { failures, checks, layout, writes, realBackendWrites: 0 };
  } finally {
    await context.close();
  }
}
