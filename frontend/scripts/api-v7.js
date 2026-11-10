async function validateApiV7(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("Use a local development page.");
  const checks = [],
    screenshots = [],
    errors = [],
    backendRequests = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const open = (p, width, hash, persona = "") =>
    p.goto(
      `${base}/?demo=1&view=${width < 600 ? "mobile" : "desktop"}${persona ? `&persona=${persona}` : ""}#${hash}`,
    );
  for (const width of [360, 390, 768, 1280, 1440]) {
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 960 },
        reducedMotion: "reduce",
      });
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (url.pathname.startsWith("/api/")) {
        backendRequests.push(url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    const mobile = width < 600;
    await open(
      p,
      width,
      mobile ? "/comments?foodId=1" : "/foods/1?section=comments",
    );
    await p
      .locator(".comments-row")
      .filter({ hasText: "分量很实在，趁热吃更好。" })
      .waitFor();
    await p.evaluate(() => document.fonts.ready);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Horizontal overflow at ${width}`,
    );
    if (mobile) {
      await p.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await p.evaluate(() => new Promise(requestAnimationFrame));
      assert(
        await p.evaluate(() => {
          const rows = document.querySelectorAll(".comments-row");
          return (
            rows[rows.length - 1].getBoundingClientRect().bottom <=
            document
              .querySelector(".comments-mobile-bar")
              .getBoundingClientRect().top
          );
        }),
        `Bottom bar hides last row at ${width}`,
      );
      await p.evaluate(() => window.scrollTo(0, 0));
    }
    if (!mobile) await p.locator("#food-discussion").scrollIntoViewIfNeeded();
    const shot = `output/playwright/api-v7-comments-${width}.png`;
    await p.screenshot({ path: shot, fullPage: mobile });
    screenshots.push(shot);
    checks.push(`${width}px comment layout`);
    if (![390, 1440].includes(width)) {
      await context.close();
      continue;
    }

    const root = p
      .locator(".comments-row")
      .filter({ hasText: "分量很实在，趁热吃更好。" });
    const like = root.getByRole("button", {
      name: "觉得这条评论有用",
      exact: true,
    });
    await like.scrollIntoViewIfNeeded();
    await p.waitForFunction(() => {
      const row = [...document.querySelectorAll(".comments-row")].find((e) =>
        e.textContent.includes("分量很实在，趁热吃更好。"),
      );
      return row && !row.querySelector(".comments-like button").disabled;
    });
    await like.click();
    await root
      .getByRole("button", { name: "取消觉得有用", exact: true })
      .waitFor();
    await root
      .getByRole("button", { name: "取消觉得有用", exact: true })
      .click();
    await root
      .getByRole("button", { name: "觉得这条评论有用", exact: true })
      .waitFor();
    checks.push(`${width}px like/unlike`);

    await p.getByRole("button", { name: "晒图", exact: true }).click();
    await p.locator(".comments-gallery img").first().waitFor();
    await p.locator(".comments-gallery button").first().click();
    await p
      .getByRole("dialog", { name: "评论图片预览", exact: true })
      .waitFor();
    await p.getByRole("button", { name: "关闭图片预览", exact: true }).click();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    const galleryShot = `output/playwright/api-v7-gallery-${width}.png`;
    await p.screenshot({ path: galleryShot, fullPage: mobile });
    screenshots.push(galleryShot);
    await p.getByRole("button", { name: "评论", exact: true }).click();
    await root.getByRole("button", { name: "查看回复", exact: true }).click();
    await root.locator(".is-reply").waitFor();
    await root
      .locator(".is-reply")
      .getByRole("button", { name: "回复", exact: true })
      .click();
    const editor = p.getByRole("textbox", { name: "回复 阿哲", exact: true });
    await editor.fill(`V7 隔离回复验收 ${width} 🍜`);
    if (mobile) {
      await p.setViewportSize({ width: 768, height: 960 });
      assert(
        (await editor.inputValue()) === `V7 隔离回复验收 ${width} 🍜`,
        "Resize discarded comment draft",
      );
      await p.setViewportSize({ width, height: 960 });
      await p.screenshot({
        path: "output/playwright/api-v7-write-390.png",
        fullPage: true,
      });
      screenshots.push("output/playwright/api-v7-write-390.png");
    }
    await p.getByRole("button", { name: "发表回复", exact: true }).click();
    if (!mobile)
      await p.getByRole("link", { name: "我的评论", exact: true }).click();
    const text = `V7 隔离回复验收 ${width} 🍜`;
    const mine = p.locator(".comments-submission").filter({ hasText: text });
    await mine.waitFor();
    assert(
      (await mine.textContent()).includes("待审核"),
      "Submission skipped moderation",
    );
    const mineShot = `output/playwright/api-v7-mine-${width}.png`;
    await p.screenshot({ path: mineShot, fullPage: mobile });
    screenshots.push(mineShot);
    checks.push(`${width}px nested reply, draft and pending record`);

    await open(p, width, "/admin/v4?tab=comments", "admin");
    const moderation = p
      .locator(".comments-submission")
      .filter({ hasText: text });
    await moderation.waitFor();
    await moderation
      .getByRole("button", { name: "确认通过", exact: true })
      .click();
    await p.waitForFunction(
      (text) =>
        [...document.querySelectorAll(".comments-submission")].some(
          (e) =>
            e.textContent.includes(text) &&
            e.querySelector('[data-status="APPROVED"]'),
        ),
      text,
    );
    await moderation
      .getByRole("button", { name: "确认通过", exact: true })
      .waitFor();
    const adminShot = `output/playwright/api-v7-admin-${width}.png`;
    await p.screenshot({ path: adminShot, fullPage: mobile });
    screenshots.push(adminShot);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Admin overflow at ${width}`,
    );

    await open(
      p,
      width,
      mobile ? "/comments?foodId=1" : "/foods/1?section=comments",
    );
    const publishedRoot = p
      .locator(".comments-row")
      .filter({ hasText: "分量很实在，趁热吃更好。" });
    await publishedRoot.waitFor();
    await publishedRoot
      .getByRole("button", { name: "查看回复", exact: true })
      .click();
    await p.getByText(text, { exact: true }).waitFor();
    await open(p, width, "/me/shares?tab=comments");
    const approved = p
      .locator(".comments-submission")
      .filter({ hasText: text });
    await approved.waitFor();
    assert(
      (await approved.textContent()).includes("已通过"),
      "Approval missing from personal record",
    );
    await approved.getByRole("button", { name: "删除", exact: true }).click();
    await approved
      .getByRole("button", { name: "确认删除", exact: true })
      .click();
    await p.locator('.comments-status[data-status="DELETED"]').waitFor();
    await p.screenshot({ path: mineShot, fullPage: mobile });
    checks.push(`${width}px moderation/publication/owner deletion`);
    await context.close();
  }
  assert(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
  assert(
    backendRequests.length === 0,
    `Unexpected backend calls: ${backendRequests.join(", ")}`,
  );
  return {
    checks,
    screenshots,
    browserErrors: errors,
    realBackendRequests: backendRequests.length,
  };
}
