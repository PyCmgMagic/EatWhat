async (page) => {
  const base = new URL(page.url()).origin + "/";
  const checks = [],
    errors = [];
  for (const state of ["member", "unread-failure", "guest"]) {
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 1440, height: 900 } });
    const p = await context.newPage();
    let unreadRequests = 0,
      externalRequests = 0,
      mutations = 0;
    p.on("pageerror", (error) => errors.push(error.message));
    try {
      if (state !== "guest")
        await context.addInitScript(() =>
          sessionStorage.setItem(
            "eatwhat-session",
            JSON.stringify({
              tokenName: "x-session",
              tokenValue: "isolated-feature-ui-test",
            }),
          ),
        );
      await context.route(
        (url) => !["127.0.0.1", "localhost"].includes(url.hostname),
        (route) => {
          externalRequests++;
          return route.abort();
        },
      );
      await context.route(
        (url) => url.pathname.startsWith("/api/"),
        (route) => {
          const path = new URL(route.request().url()).pathname.slice(4);
          if (!["GET", "HEAD"].includes(route.request().method())) mutations++;
          let data = null;
          if (path === "/user/info")
            data = {
              id: 10,
              verified: true,
              banned: false,
              role: "user",
              displayName: "功能验收",
            };
          else if (path === "/campus/list") data = [];
          else if (path === "/remote-config")
            data = {
              configVersion: 1,
              flags: {},
              params: {},
              maintenance: { mode: "NONE" },
              announcements: [],
              versions: {},
              update: null,
            };
          else if (path === "/notification/cards/unread/count") {
            unreadRequests++;
            if (state === "unread-failure")
              return route.fulfill({
                status: 500,
                contentType: "application/json",
                body: JSON.stringify({
                  code: 500,
                  msg: "isolated test failure",
                }),
              });
            data = { cards: 3, members: 123 };
          } else if (path === "/notification/unread/count") data = 0;
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ code: 0, msg: "ok", data }),
          });
        },
      );
      await p.goto(base + "?demo=0#/features");
      await p.getByRole("heading", { name: "全部功能", exact: true }).waitFor();
      if (state === "member") {
        await p.locator(".feature-quick .feature-unread").waitFor();
        if (
          (await p.locator(".feature-quick .feature-unread").innerText()) !==
          "99+"
        )
          throw new Error("Unread badge must cap at 99+");
        if ((await p.locator(".feature-unread").count()) !== 2)
          throw new Error(
            "Both notification entries should show unread counts",
          );
      } else {
        if ((await p.locator(".feature-unread").count()) !== 0)
          throw new Error("Unknown unread state must not display a badge");
      }
      if (state === "guest") {
        if (unreadRequests !== 0)
          throw new Error("Guest requested unread data");
        await p
          .locator('.feature-link[href="#/auth/account-recovery"]')
          .click();
        await p
          .getByRole("heading", { name: "恢复账号操作", exact: true })
          .waitFor();
      }
      if (externalRequests || mutations)
        throw new Error(JSON.stringify({ externalRequests, mutations }));
      checks.push({ state, unreadRequests, externalRequests, mutations });
    } finally {
      await context.close();
    }
  }
  if (errors.length) throw new Error(JSON.stringify(errors));
  return { checks, pageErrors: errors, realBackendRequests: 0 };
}
