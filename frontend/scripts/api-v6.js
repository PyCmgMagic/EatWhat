async function validateApiV6(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  for (const width of [320, 390, 1440]) {
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width, height: 960 } });
    const p = await context.newPage(),
      writes = [],
      reads = [];
    p.setDefaultTimeout(15000);
    p.on("pageerror", (error) => errors.push(error.message));
    await p.emulateMedia({ reducedMotion: "reduce" });
    await context.addInitScript(() =>
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-v6-test",
          tokenValue: "isolated-v6-test",
        }),
      ),
    );
    const user = {
      id: 10,
      displayName: "校园食友",
      userName: "random_user",
      hasUsername: false,
      hasPassword: false,
      phone: "13800000000",
      verified: true,
      banned: false,
      role: "user",
    };
    let requireReauth = false,
      growthMode = "normal",
      cancellationFails = false,
      authorMode = "new",
      statsFails = false;
    const growth = {
      totalExperience: 125,
      level: 3,
      levelStartExperience: 100,
      nextLevelExperience: 250,
      experienceInLevel: 25,
      experienceToNextLevel: 125,
      maxLevel: false,
      dailyExperience: 5,
      levelRuleVersion: "v1",
    };
    await context.route(
      () => true,
      async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (url.origin !== base) return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (request.method() === "GET")
          reads.push({
            path: url.pathname,
            query: Object.fromEntries(url.searchParams),
          });
        else writes.push({ path: url.pathname, body: request.postDataJSON() });
        let data = { items: [], totalItems: 0, hasNext: false };
        if (url.pathname === "/api/user/info") data = user;
        else if (url.pathname === "/api/auth/username/set") {
          const body = request.postDataJSON();
          user.userName = body.userName;
          user.hasUsername = true;
          user.hasPassword = !!body.newPassword;
          data = {
            userName: user.userName,
            hasUsername: true,
            hasPassword: user.hasPassword,
            reauthenticationRequired: requireReauth,
          };
        } else if (url.pathname === "/api/user/activity") {
          assert(request.postData() == null, "Activity supplied a body");
          data = {
            businessDate: "2026-11-08",
            firstUseToday: false,
            experienceAdded: 0,
            growth:
              growthMode === "max"
                ? {
                    ...growth,
                    maxLevel: true,
                    level: 10,
                    totalExperience: 16010,
                    nextLevelExperience: null,
                    experienceToNextLevel: 0,
                  }
                : growth,
          };
        } else if (url.pathname === "/api/user/growth") {
          if (growthMode === "error")
            return route.fulfill({
              status: 503,
              json: { code: 503, msg: "成长记录暂时不可用", data: null },
            });
          data =
            growthMode === "max"
              ? {
                  ...growth,
                  maxLevel: true,
                  level: 10,
                  totalExperience: 16010,
                  nextLevelExperience: null,
                  experienceToNextLevel: 0,
                }
              : growth;
        } else if (url.pathname === "/api/user/growth/ledger") {
          const page = Number(url.searchParams.get("page"));
          data = {
            items:
              growthMode === "empty"
                ? []
                : [
                    {
                      entryId: `entry-${page}`,
                      sourceType: "DAILY_USE",
                      businessDate: page === 1 ? "2026-11-07" : "2026-11-06",
                      experience: 5,
                      ruleVersion: "v1",
                      createdAt: "2026-11-08T02:00:00Z",
                    },
                  ],
            totalItems: growthMode === "empty" ? 0 : 21,
            currentPage: page,
            totalPages: 2,
            hasNext: growthMode !== "empty" && page === 1,
          };
        } else if (url.pathname === "/api/admin/engagement/stats") {
          assert(user.role === "admin", "Non-admin requested statistics");
          if (statsFails)
            return route.fulfill({
              status: 503,
              json: { code: 503, msg: "统计暂不可用", data: null },
            });
          data = {
            date: url.searchParams.get("date") || "2026-11-08",
            month: "2026-11",
            dailyActiveUsers: 0,
            monthlyActiveUsers: 21,
            rolling30ActiveUsers: 30,
            rolling30Start: "2026-10-10",
            timezone: "Asia/Shanghai",
          };
        } else if (url.pathname === "/api/user/cancellation") {
          if (cancellationFails) return route.abort();
          data = {
            requestId: request.postDataJSON().requestId,
            phase: "PENDING",
            deadline: "2026-11-15T00:00:00Z",
            complete: false,
          };
        } else if (url.pathname === "/api/foods/detail/71")
          data = {
            id: 71,
            name: "校园牛肉面",
            accountId: 30,
            uploaderName: "旧作者",
            user:
              authorMode === "new"
                ? { id: 42, displayName: "新的菜品作者" }
                : authorMode === "null"
                  ? null
                  : undefined,
            restaurantId: 1,
            restaurantName: "校园面馆",
            category: "staple",
            price: 18.9,
            isLiked: false,
            isFavorite: false,
            pictureUrl: [],
          };
        else if (url.pathname === "/api/restaurant/detail/1")
          data = {
            id: 1,
            name: "校园面馆",
            address: "软件园校区",
            pictureUrl: [],
          };
        else if (url.pathname === "/api/campus/list")
          data = [{ id: 1, name: "软件园", isDefault: true }];
        else if (url.pathname === "/api/remote-config")
          data = {
            configVersion: 1,
            flags: {},
            params: {},
            maintenance: { mode: "NONE" },
            announcements: [],
            versions: {},
          };
        else if (
          url.pathname === "/api/foods/recommend" ||
          url.pathname === "/api/foods/tags/system"
        )
          data = [];
        else if (url.pathname === "/api/auth/consent/policy")
          data = { version: "v1", url: "/api/policies/v1.html" };
        else if (url.pathname === "/api/notification/unread/count") data = 0;
        return route.fulfill({ status: 200, json: { code: 0, data } });
      },
    );
    const go = (path) => p.goto(`${base}/?demo=0#${path}`);
    try {
      await go("/me");
      await p.locator("body").ariaSnapshot();
      await p.locator(".profile-overview-growth").waitFor();
      await p.screenshot({
        path: `output/playwright/api-v6-profile-${width}.png`,
        fullPage: true,
      });
      await p.locator(".profile-overview-growth").click();
      await p.getByRole("heading", { name: "Lv.3", exact: true }).waitFor();
      await p.getByText("所属日期 2026-11-07", { exact: true }).waitFor();
      assert(
        (await p.getByRole("progressbar").getAttribute("aria-valuenow")) ===
          "17",
        "Returned thresholds were not used",
      );
      await p.getByRole("button", { name: "下一页", exact: true }).click();
      await p.getByText("所属日期 2026-11-06", { exact: true }).waitFor();
      await p.getByRole("button", { name: "上一页", exact: true }).click();
      await p.getByText("所属日期 2026-11-07", { exact: true }).waitFor();
      assert(
        writes.filter((w) => w.path === "/api/user/activity").length === 1,
        "Route changes repeated activity reports",
      );
      await p.screenshot({
        path: `output/playwright/api-v6-growth-${width}.png`,
        fullPage: true,
      });
      assert(
        !(await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )),
        "Growth page has horizontal overflow",
      );
      checks.push(
        `${width}px: profile entry, server growth progress, paginated ledger with original business date, deduplicated activity`,
      );

      growthMode = "max";
      await p.reload();
      await p.getByText("已达到当前最高等级", { exact: true }).waitFor();
      assert(
        (await p.getByRole("progressbar").getAttribute("aria-valuenow")) ===
          "100",
        "Max level progress is not complete",
      );
      growthMode = "empty";
      await p.reload();
      await p.getByText("还没有经验记录", { exact: true }).waitFor();
      // Keep the background response from filling the progress cache during this failure case.
      await context.route("**/api/user/activity", (route) =>
        route.fulfill({
          status: 503,
          json: { code: 503, msg: "暂不可用", data: null },
        }),
      );
      growthMode = "error";
      await p.reload();
      await p.getByText("成长记录暂时不可用", { exact: true }).waitFor();
      growthMode = "normal";
      await p.getByRole("button", { name: "重新加载", exact: true }).click();
      await p.getByRole("heading", { name: "Lv.3" }).waitFor();
      assert(
        (await p.getByRole("dialog").count()) === 0,
        "Passive failure opened an auth dialog",
      );
      checks.push(
        `${width}px: max level, empty ledger, failed read retry and quiet background failures`,
      );

      await go("/settings/username");
      await p.locator('input[name="userName"]').fill("Campus10");
      await p.locator('input[name="code"]').fill("123456");
      await p.getByRole("button", { name: "保存登录名", exact: true }).click();
      await p.waitForURL(/#\/settings\/account$/);
      assert(
        (
          await p.evaluate(() =>
            JSON.parse(localStorage.getItem("eatwhat-session")),
          )
        ).tokenValue === "isolated-v6-test",
        "Username setup destroyed the current session",
      );
      assert(
        writes.filter((w) => w.path === "/api/auth/username/set").length === 1,
        "Username write repeated",
      );
      checks.push(
        `${width}px: username setup retains session and returns to account settings`,
      );

      for (const deletion of [false, true]) {
        await go("/settings/delete");
        if (deletion) await p.reload();
        await p
          .getByRole("radio", {
            name: "匿名保留正文和图片（默认）",
            exact: true,
          })
          .waitFor();
        if (deletion) {
          await p
            .getByRole("radio", {
              name: "删除我发布的帖子、评论及其图片",
              exact: true,
            })
            .check();
          cancellationFails = true;
        }
        await p.getByRole("checkbox", { name: /我已了解注销/ }).check();
        await p
          .getByRole("button", { name: "提交注销申请", exact: true })
          .click();
        if (deletion) await p.getByText(/本次结果尚未确认/).waitFor();
        else
          await p
            .getByRole("heading", { name: "注销进度", exact: true })
            .waitFor();
        const request = writes
          .filter((w) => w.path === "/api/user/cancellation")
          .at(-1);
        assert(
          request.body.deletePostsAndComments === deletion,
          "Wrong content deletion choice",
        );
        assert(
          await p
            .getByRole("radio", {
              name: "匿名保留正文和图片（默认）",
              exact: true,
            })
            .isDisabled(),
          "Accepted/uncertain choice remained editable",
        );
        await go("/settings/account");
        await go("/settings/delete");
        assert(
          await p
            .getByRole("radio", {
              name: deletion
                ? "删除我发布的帖子、评论及其图片"
                : "匿名保留正文和图片（默认）",
              exact: true,
            })
            .isChecked(),
          "Navigating back changed the signed request choice",
        );
        await p.screenshot({
          path: `output/playwright/api-v6-cancellation-${width}-${deletion}.png`,
          fullPage: true,
        });
        await p.getByText("保存本次恢复信息", { exact: true }).click();
        const downloaded = p.waitForEvent("download");
        await p
          .getByRole("button", { name: "保存恢复文件", exact: true })
          .click();
        const file = await downloaded,
          chunks = [];
        for await (const chunk of await file.createReadStream())
          chunks.push(chunk);
        const exported = Buffer.concat(chunks).toString();
        assert(
          JSON.parse(exported).deletePostsAndComments === deletion,
          "Recovery export lost the content choice",
        );
        await file.delete();
        await go("/auth/account-recovery");
        await p.reload();
        await p.locator('input[type="file"]').setInputFiles({
          name: "isolated-recovery.json",
          mimeType: "application/json",
          buffer: Buffer.from(exported),
        });
        await p.waitForFunction(
          () => !!document.querySelector('input[name="proof"]')?.value,
        );
        await p
          .getByRole("button", { name: "读取恢复信息", exact: true })
          .click();
        await p
          .getByRole("heading", { name: "验证身份并撤销注销", exact: true })
          .waitFor();
        await go("/settings/delete");
        assert(
          await p
            .getByRole("radio", {
              name: deletion
                ? "删除我发布的帖子、评论及其图片"
                : "匿名保留正文和图片（默认）",
              exact: true,
            })
            .isChecked(),
          "Recovery import changed the original choice",
        );
      }
      checks.push(
        `${width}px: default retention and explicit deletion are sent correctly; accepted/uncertain requests lock their choice across navigation and recovery file export/import`,
      );

      for (const mode of ["new", "null", "legacy"]) {
        authorMode = mode;
        await go("/foods/71");
        await p.reload();
        await p.getByText("校园牛肉面", { exact: true }).first().waitFor();
        if (mode === "new")
          await p.getByRole("link", { name: /新的菜品作者/ }).waitFor();
        else if (mode === "null")
          assert(
            (await p.locator('a[href="#/users/30"]').count()) === 0,
            "Explicit null author still links to a profile",
          );
        else await p.locator('a[href="#/users/30"]').waitFor();
      }
      checks.push(
        `${width}px: new, explicitly unavailable and legacy food authors render correctly`,
      );

      const statsBefore = reads.filter(
        (r) => r.path === "/api/admin/engagement/stats",
      ).length;
      await go("/admin/v4?tab=engagement");
      await p.getByText("此页面需要管理员身份。", { exact: true }).waitFor();
      assert(
        reads.filter((r) => r.path === "/api/admin/engagement/stats").length ===
          statsBefore,
        "Ordinary user fetched admin stats",
      );
      user.role = "admin";
      await p.reload();
      await p
        .getByRole("heading", { name: "用户活跃统计", exact: true })
        .waitFor();
      await p.locator(".growth-stats dd").first().waitFor();
      assert(
        (await p.locator(".growth-stats dd").first().innerText()) === "0",
        "Zero DAU rendered as missing",
      );
      await p.locator('input[type="date"]').fill("2026-11-07");
      await p.getByRole("button", { name: "查询统计", exact: true }).click();
      await p
        .getByText("统计日：2026-11-07 · 北京时间", { exact: true })
        .waitFor();
      assert(
        reads.filter((r) => r.path === "/api/admin/engagement/stats").at(-1)
          .query.date === "2026-11-07",
        "Date filter was not sent",
      );
      await p.locator('input[type="date"]').fill("2099-01-01");
      assert(
        await p
          .locator('input[type="date"]')
          .evaluate((el) => !el.checkValidity()),
        "Future date is not blocked",
      );
      await p.locator('input[type="date"]').fill("2026-11-07");
      await p.screenshot({
        path: `output/playwright/api-v6-engagement-${width}.png`,
        fullPage: true,
      });
      assert(
        (await p.locator('input[type="date"]').inputValue()) === "2026-11-07",
        "Statistics date filter was reset",
      );
      await p
        .getByText("统计日：2026-11-07 · 北京时间", { exact: true })
        .waitFor();
      statsFails = true;
      await p.getByRole("button", { name: "查询统计", exact: true }).click();
      await p.getByText(/刷新失败，正在显示上次读取的内容/).waitFor();
      assert(
        (await p.locator(".growth-stats dd").first().innerText()) === "0",
        "Failed refresh lost prior statistics",
      );
      statsFails = false;
      await p.getByRole("button", { name: "重试", exact: true }).click();
      checks.push(
        `${width}px: admin guard, daily/monthly/rolling stats, zero, date filter, future-date rejection and cached failure recovery`,
      );

      user.role = "user";
      user.hasUsername = false;
      requireReauth = true;
      await go("/settings/username");
      await p.reload();
      await p.locator('input[name="userName"]').fill("Legacy10");
      await p.locator('input[name="code"]').fill("123456");
      await p.getByRole("button", { name: "保存登录名", exact: true }).click();
      await p.waitForFunction(
        () => localStorage.getItem("eatwhat-session") === "null",
      );
      await p.waitForURL(/#\/auth\/password$/);
      await p.locator('input[name="username"]').waitFor();
      assert(
        (await p.locator('input[name="username"]').inputValue()) === "Legacy10",
        "Reauthentication lost the new login name",
      );
      checks.push(
        `${width}px: old explicit reauthentication response still clears the session`,
      );
      assert(
        !(await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )),
        "Horizontal overflow",
      );
    } catch (e) {
      await p.screenshot({
        path: `output/playwright/api-v6-failure-${width}.png`,
        fullPage: true,
      });
      throw new Error(
        `${width}px: ${e.message}; URL ${p.url()}; completed ${checks.length} checks; page errors ${errors.join("; ")}`,
      );
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, errors.join("; "));
  return { checks, errors, realBackendRequests: 0 };
}
