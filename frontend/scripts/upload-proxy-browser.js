async function validateUploadProxy(page) {
  const base = "http://127.0.0.1:5173";
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  const errors = [],
    writes = [],
    puts = [],
    external = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1")
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-upload-test",
          tokenValue: "isolated-upload-validation",
        }),
      );
  });
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  let target,
    signedCount = 0,
    putFails = true;
  await context.route(
    (url) => url.origin !== base,
    (route) => {
      external.push(route.request().url().split("?")[0]);
      return route.abort();
    },
  );
  await context.route(
    (url) => url.pathname.startsWith("/__storage_upload/"),
    async (route) => {
      const request = route.request();
      puts.push({
        path: new URL(request.url()).pathname,
        method: request.method(),
        headers: await request.allHeaders(),
        bytes: request.postDataBuffer()?.length || 0,
      });
      return putFails
        ? route.abort("failed")
        : route.fulfill({ status: 200, body: "" });
    },
  );
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (request.method() !== "GET")
        writes.push({ path, body: request.postDataJSON() });
      let data = [];
      if (path === "/api/user/info")
        data = {
          id: 10,
          displayName: "上传测试",
          verified: true,
          banned: false,
        };
      else if (path.startsWith("/api/restaurant/detail/"))
        data = { id: 1, name: "测试食堂" };
      else if (path === "/api/foods/tags/my")
        data = { items: [], totalItems: 0, hasNext: false };
      else if (path === "/api/upload/presign") {
        signedCount++;
        data = {
          key: "foods/upload-test.jpg",
          putUrl:
            target +
            "/staging/isolated-" +
            signedCount +
            "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=" +
            "a".repeat(64) +
            "&X-Amz-SignedHeaders=content-type%3Bhost",
        };
      } else if (path === "/api/upload/complete")
        data = { key: "foods/upload-test.jpg", revision: 1, size: 100 };
      else if (path === "/api/foods/upload") data = { id: 91 };
      else if (path === "/api/foods/detail/91")
        data = {
          id: 91,
          name: "上传验证菜",
          price: 12,
          restaurantId: 1,
          restaurantName: "测试食堂",
          category: "staple",
          pictureUrl: ["/prototype/assets/photos/sq_luosi.png"],
          accountId: 10,
        };
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
      else if (request.method() !== "GET") {
        errors.push("Unexpected write: " + path);
        return route.abort();
      }
      return route.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  try {
    await p.goto(base + "/?demo=0#/publish/dish");
    // Read only the non-secret dev target, never an account/session or signed URL.
    target = await p.evaluate(async () => {
      const source = await (await fetch("/src/api/upload-target.ts")).text();
      const match = source.match(
        /DEV_UPLOAD_TARGET[^\n]*?(https:\/\/[^"\s]+\/eatwhat)/,
      );
      return match?.[1];
    });
    assert(target, "The running development server has no upload proxy target");
    await p
      .getByRole("textbox", { name: "菜名", exact: true })
      .fill("上传验证菜");
    await p.getByRole("textbox", { name: "价格", exact: true }).fill("12");
    const chooser = p.waitForEvent("filechooser");
    await p.getByRole("button", { name: "再加一张照片", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: "sq_luosi.png",
      mimeType: "image/png",
      buffer: await (
        await p.request.get(base + "/prototype/assets/photos/sq_luosi.png")
      ).body(),
    });
    await p.waitForURL(/#\/publish\/crop/);
    await p.getByRole("link", { name: "完成", exact: true }).click();
    await p.waitForURL(/#\/publish\/dish/);
    await p.getByRole("link", { name: "发布", exact: true }).click();
    await p.getByText(/图片未能连接上传服务/).waitFor();
    assert(
      writes.every(
        (entry) =>
          !["/api/upload/complete", "/api/foods/upload"].includes(entry.path),
      ),
      "A failed PUT continued to confirmation or publication",
    );
    assert(
      (await p
        .getByRole("textbox", { name: "菜名", exact: true })
        .inputValue()) === "上传验证菜",
      "Draft was lost",
    );
    for (const width of [320, 390, 520]) {
      await p.setViewportSize({ width, height: 844 });
      const banner = await p.getByRole("alert").boundingBox();
      const action = await p
        .getByRole("link", { name: "发布", exact: true })
        .boundingBox();
      assert(
        banner && action && banner.y + banner.height <= action.y,
        "Failure banner blocks retry at " + width,
      );
      await p.screenshot({
        path: `output/playwright/upload-network-failure-${width}.png`,
        animations: "disabled",
        fullPage: true,
      });
    }
    await p.setViewportSize({ width: 390, height: 844 });
    putFails = false;
    await p.getByRole("link", { name: "发布", exact: true }).click();
    await p.waitForURL(/#\/foods\/91$/);
    assert(signedCount === 2, "Retry did not obtain a fresh signed URL");
    assert(
      puts.length === 2 &&
        puts.every(
          (entry) =>
            entry.method === "PUT" &&
            entry.bytes > 100 &&
            entry.headers["content-type"] === "image/jpeg" &&
            !entry.headers.authorization &&
            !entry.headers.cookie &&
            !entry.headers["x-upload-test"],
        ),
      "Upload bytes, type or credential isolation is incorrect",
    );
    assert(
      writes.filter((entry) => entry.path === "/api/upload/complete").length ===
        1,
      "Unexpected file confirmation count",
    );
    const created = writes.filter(
      (entry) => entry.path === "/api/foods/upload",
    );
    assert(
      created.length === 1 &&
        created[0].body.pictureUrl.join() === "foods/upload-test.jpg",
      "Unexpected publication payload",
    );
    assert(
      !external.some((url) => url.includes("cloudflarestorage.com")),
      "The browser still contacted R2 directly",
    );
    assert(!errors.length, "Browser errors: " + errors.join("; "));
    return {
      checks: [
        "Mobile publish routes signed PUTs through the configured same-origin endpoint",
        "Network failure shows useful feedback and preserves the draft without publishing",
        "Retry gets fresh credentials, then confirms the uploaded key and publishes once",
      ],
      errors,
      realBackendWrites: 0,
    };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/upload-proxy-failure.png",
      animations: "disabled",
      fullPage: true,
    });
    throw new Error(
      String(error) +
        "\n" +
        JSON.stringify({
          errors,
          paths: writes.map((entry) => entry.path),
          puts: puts.length,
        }) +
        "\n" +
        (await p.locator("body").innerText()),
    );
  } finally {
    await context.close();
  }
}
