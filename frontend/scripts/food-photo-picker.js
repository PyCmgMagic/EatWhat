async function verifyFoodPhotos(browserPage) {
  const base = "http://127.0.0.1:5173";
  const context = await browserPage
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
  const page = await context.newPage(),
    checks = [],
    errors = [],
    unexpected = [],
    writes = [],
    puts = [];
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) =>
    dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss(),
  );
  await context.addInitScript(() =>
    localStorage.setItem(
      "eatwhat-session",
      JSON.stringify({ tokenName: "x-photo-test", tokenValue: "isolated" }),
    ),
  );
  const photoUrl = "/prototype/assets/photos/sq_luosi.png";
  let food,
    uploadNumber = 0,
    failSave = false,
    uploadGate,
    releaseUpload;
  const resetFood = () =>
    (food = {
      id: 71,
      accountId: 90,
      name: "螺蛳粉",
      description: "酸辣开胃",
      restaurantId: 1,
      restaurantName: "校园小馆",
      price: 18,
      category: "staple",
      pictureUrl: [photoUrl],
      pictureKeys: ["foods/existing.jpg"],
      stageColor: "porcelain",
      mealTimes: ["dinner"],
      coverCrop: { centerX: 0.4, centerY: 0.6, diameter: 0.8 },
    });
  resetFood();
  const credential = () => {
    const n = ++uploadNumber;
    return {
      key: "foods/new-" + n + ".png",
      putUrl: base + "/photo-test-storage/" + n,
    };
  };
  await context.route(
    (u) => u.origin !== base,
    (r) => r.abort(),
  );
  await context.route(
    (u) => u.pathname.startsWith("/photo-test-storage/"),
    async (r) => {
      puts.push(r.request().headers());
      await uploadGate;
      await r.fulfill({ status: 200, body: "" });
    },
  );
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    async (r) => {
      const req = r.request(),
        path = new URL(req.url()).pathname.slice(4);
      let data = null,
        status = 200,
        msg = "ok",
        code = 0;
      if (req.method() !== "GET")
        writes.push({ path, body: req.postDataJSON() });
      if (path === "/user/info")
        data = {
          id: 90,
          displayName: "食友",
          userName: "foodtester",
          role: "user",
          verified: true,
          banned: false,
        };
      else if (path === "/remote-config")
        data = {
          configVersion: 1,
          flags: {},
          params: {},
          maintenance: { mode: "NONE" },
          announcements: [],
          versions: {},
        };
      else if (path === "/campus/list")
        data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
      else if (
        path === "/notification/unread/count" ||
        path === "/notification/cards/unread/count"
      )
        data = 0;
      else if (path === "/foods/detail/71") data = food;
      else if (path === "/upload/presign") data = credential();
      else if (path === "/upload/presign/batch")
        data = { files: req.postDataJSON().files.map(credential) };
      else if (path === "/upload/complete")
        data = { key: req.postDataJSON().key };
      else if (path === "/foods/my/edit/71" || path === "/foods/my/71") {
        if (failSave) {
          status = 400;
          code = 999;
          msg = "测试：保存失败，请重试";
        } else {
          const patch = req.postDataJSON();
          food = {
            ...food,
            ...patch,
            pictureKeys: patch.pictureUrl ?? food.pictureKeys,
            pictureUrl:
              patch.pictureUrl?.map(() => photoUrl) ?? food.pictureUrl,
          };
        }
      } else if (path === "/foods/tags/system") data = [];
      else if (path === "/foods/tags/my") data = { items: [], hasNext: false };
      else if (path === "/restaurant/detail/1")
        data = { id: 1, name: "校园小馆" };
      else if (
        path === "/user/activity" ||
        path === "/history/browse" ||
        path.startsWith("/analytics/")
      )
        data = null;
      else {
        unexpected.push(path);
        status = 404;
        code = 404;
        msg = "Unexpected " + path;
      }
      await r.fulfill({ status, json: { code, msg, data } });
    },
  );
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const count = async (n) => {
    await page.waitForFunction(
      (n) => document.querySelectorAll(".food-photo-tile").length === n,
      n,
    );
  };
  const file = {
    name: "新增照片.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG6sAAAAASUVORK5CYII=",
      "base64",
    ),
  };
  const input = () => page.getByLabel("选择菜品照片", { exact: true });
  const save = () =>
    page.getByRole("button", { name: "保存菜品修改", exact: true });
  const editWrites = () =>
    writes.filter((w) => /^\/foods\/my\/(edit\/)?71$/.test(w.path));
  async function open(width, label) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + "/?demo=0&photoCase=" + label + "#\/foods/71/edit");
    await page.locator(".food-photo-picker").waitFor();
    await page.evaluate(() => document.fonts.ready);
  }
  async function drag(files, event = "drop") {
    const transfer = await page.evaluateHandle((files) => {
      const dt = new DataTransfer();
      for (const f of files)
        dt.items.add(
          new File([new Uint8Array(f.size ?? 8)], f.name, { type: f.type }),
        );
      return dt;
    }, files);
    await page
      .locator(".food-photo-dropzone")
      .dispatchEvent(event, { dataTransfer: transfer });
    await transfer.dispose();
  }
  try {
    for (const width of [320, 390, 520, 768, 1024, 1440, 1920]) {
      await open(width, "layout-" + width);
      await count(1);
      const size = await page.locator(".food-photo-preview").boundingBox();
      assert(
        Math.abs(size.width - size.height) < 1,
        "Non-square photo at " + width,
      );
      const addSize = await page
        .getByRole("button", { name: "添加照片", exact: true })
        .boundingBox();
      assert(
        Math.abs(size.height - addSize.height) < 1,
        "Uneven add tile at " + width,
      );
      assert(
        !(await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )),
        "Overflow at " + width,
      );
      assert(await input().isHidden(), "Native file input visible");
      const remove = await page
        .getByRole("button", { name: "移除第 1 张照片", exact: true })
        .boundingBox();
      assert(
        remove.width >= 44 && remove.height >= 44,
        "Small remove target at " + width,
      );
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: "../output/playwright/food-photo-picker-" + width + ".png",
          fullPage: true,
        });
      checks.push("Layout " + width);
    }
    await open(1440, "interaction");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "添加照片", exact: true }).click();
    await (await chooser).setFiles([]);
    await count(1);
    assert(await save().isDisabled(), "Cancel changed draft");
    await input().setInputFiles([file, { ...file, name: "第二张.png" }]);
    await count(3);
    assert((await input().inputValue()) === "", "File input not reset");
    await page
      .getByRole("button", { name: "预览第 1 张照片（封面）", exact: true })
      .click();
    await page.getByRole("dialog", { name: "照片预览 · 1 / 3" }).waitFor();
    await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert(editWrites().length === 0, "Preview submitted form");
    assert(
      await page
        .getByRole("button", { name: "预览第 1 张照片（封面）", exact: true })
        .evaluate((el) => el === document.activeElement),
      "Preview lost focus",
    );
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page
      .getByRole("button", { name: "移除第 3 张照片", exact: true })
      .click();
    await count(2);
    await input().setInputFiles(file);
    await count(3);
    checks.push(
      "Chooser cancel, multiple selection, same-file re-add, preview/close/Escape/focus without submit",
    );
    await drag([{ name: "bad.txt", type: "text/plain" }]);
    await page.getByRole("alert").filter({ hasText: "请选择 JPG" }).waitFor();
    await count(3);
    await drag([
      { name: "large.png", type: "image/png", size: 10 * 1024 * 1024 + 1 },
    ]);
    await page.getByRole("alert").filter({ hasText: "10 MB" }).waitFor();
    await count(3);
    await drag([{ name: "empty.png", type: "image/png", size: 0 }]);
    await page.getByRole("alert").filter({ hasText: "空文件" }).waitFor();
    await count(3);
    const six = Array.from({ length: 6 }, (_, i) => ({
      name: "拖入" + i + ".png",
      type: "image/png",
    }));
    await drag(six, "dragenter");
    assert(
      await page.locator(".food-photo-drop-hint").isVisible(),
      "No drag highlight",
    );
    await drag(six);
    await count(9);
    assert(
      !(await page
        .getByRole("button", { name: "添加照片", exact: true })
        .count()),
      "Add visible at limit",
    );
    await drag([{ name: "too-many.png", type: "image/png" }]);
    await page.getByRole("alert").filter({ hasText: "最多选择 9" }).waitFor();
    await count(9);
    checks.push(
      "Drag highlight, multi-file drop, invalid/empty/oversize rejection, nine-photo limit",
    );
    for (let i = 9; i >= 1; i--)
      await page
        .getByRole("button", { name: "移除第 " + i + " 张照片", exact: true })
        .click();
    await count(0);
    await page.locator(".food-photo-add[data-empty]").waitFor();
    await save().click();
    await page
      .getByRole("alert")
      .filter({ hasText: "至少保留一张照片" })
      .waitFor();
    assert(editWrites().length === 0, "Empty gallery submitted");
    checks.push("Empty gallery state and save guard");
    await open(1440, "crop-preservation");
    await count(1);
    await input().setInputFiles([file, { ...file, name: "第二张.png" }]);
    await count(3);
    uploadGate = new Promise((resolve) => (releaseUpload = resolve));
    failSave = true;
    await save().click();
    await page.getByRole("button", { name: "正在保存…" }).waitFor();
    assert(
      await page
        .getByRole("button", { name: "添加照片", exact: true })
        .isDisabled(),
      "Picker not disabled during save",
    );
    await drag([{ name: "while-busy.png", type: "image/png" }]);
    await count(3);
    releaseUpload();
    uploadGate = undefined;
    await page
      .getByRole("alert")
      .filter({ hasText: "测试：保存失败" })
      .waitFor();
    await count(3);
    const patch = editWrites().at(-1).body;
    assert(
      patch.pictureUrl[0] === "foods/existing.jpg" &&
        patch.pictureUrl.length === 3,
      "Existing key lost",
    );
    assert(!("coverCrop" in patch), "Adding photos reset original crop");
    assert(puts.length === 2, "Wrong upload count");
    const beforeRetry = uploadNumber;
    failSave = false;
    await save().click();
    await page.waitForURL(/#\/foods\/71$/);
    assert(uploadNumber === beforeRetry, "Retry re-uploaded completed files");
    checks.push(
      "Busy-drop guard, batch upload, existing cover/crop retained, failed-save draft and uploaded keys reused",
    );
    await open(1440, "text-only");
    await count(3);
    await page.getByLabel("菜品名称", { exact: true }).fill("螺蛳粉加蛋");
    await save().click();
    await page.waitForURL(/#\/foods\/71$/);
    assert(
      !("pictureUrl" in editWrites().at(-1).body) &&
        !("coverCrop" in editWrites().at(-1).body),
      "Text-only edited pictures",
    );
    await open(1440, "replace-cover");
    await page
      .getByRole("button", { name: "移除第 1 张照片", exact: true })
      .click();
    await count(2);
    await save().click();
    await page.waitForURL(/#\/foods\/71$/);
    assert(
      editWrites().at(-1).body.coverCrop?.diameter === 1,
      "New cover inherited old crop",
    );
    assert(
      !puts.some((h) => h["x-photo-test"] || h.authorization),
      "Storage received session",
    );
    checks.push(
      "Text-only preserves photos; removing cover resets crop for new cover; no storage session leak",
    );
    assert(!errors.length, errors.join("\n"));
    assert(!unexpected.length, unexpected.join(", "));
    return {
      checks,
      pageErrors: errors,
      storagePuts: puts.length,
      realBackendRequests: 0,
    };
  } catch (error) {
    await page.screenshot({
      path: "../output/playwright/food-photo-picker-failure.png",
      fullPage: true,
    });
    throw new Error(
      JSON.stringify({
        error: String(error),
        checks,
        unexpected,
        errors,
        url: page.url(),
        text: (await page.locator("body").innerText()).slice(0, 1000),
      }),
    );
  } finally {
    releaseUpload?.();
    await context.close();
  }
}
