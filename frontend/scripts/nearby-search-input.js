async function validateNearbySearchInput(browserPage) {
  const origin = await browserPage.evaluate(() => location.origin);
  const browser = browserPage.context().browser();
  const shop = { id: 81, name: "滨寿司", address: "高新万达" };
  const results = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  for (const width of [1440, 390]) {
    const desktop = width === 1440;
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const searches = [];
    await context.addInitScript(() => {
      localStorage.setItem(
        "eatwhat-area",
        JSON.stringify({
          name: "软件园校区",
          gcjLng: 117.134,
          gcjLat: 36.667,
          source: "hub",
        }),
      );
    });
    await context.route(
      (url) => url.origin !== origin,
      (route) => route.abort(),
    );
    await context.route(
      (url) => url.pathname.startsWith("/api/"),
      (route) => {
        const path = route.request().url().slice(origin.length);
        let data = [];
        if (/^\/api\/restaurant\/(browse|search)(\?|$)/.test(path)) {
          const keyword = decodeURIComponent(
            path.match(/[?&]keyword=([^&]*)/)?.[1] ?? "",
          );
          searches.push(keyword);
          const items = shop.name.includes(keyword) ? [shop] : [];
          data = { items, totalItems: items.length, hasNext: false };
        } else if (path.startsWith("/api/remote-config")) {
          data = {
            configVersion: 1,
            flags: {},
            params: {},
            maintenance: { mode: "NONE" },
            announcements: [],
            versions: {},
          };
        }
        return route.fulfill({ json: { code: 0, data } });
      },
    );

    try {
      await page.goto(origin + "/#/nearby");
      const row = page
        .locator(desktop ? ".pc-shop-row" : ".mobile-nearby-shop")
        .getByText(shop.name, { exact: true });
      await row.waitFor();
      const input = page.getByRole(desktop ? "textbox" : "searchbox", {
        name: desktop ? "附近搜店名" : "搜店名或地址",
        exact: true,
      });
      await input.focus();
      const focus = await input.evaluate((element) => ({
        spellcheck: element.spellcheck,
        inputShadow: getComputedStyle(element).boxShadow,
        fieldShadow: getComputedStyle(element.parentElement).boxShadow,
      }));
      assert(
        !focus.spellcheck &&
          focus.inputShadow === "none" &&
          focus.fieldShadow.includes("2px"),
        width + "px: search focus styles",
      );

      const before = page.url();
      const cdp = await context.newCDPSession(page);
      for (const text of ["b", "bi", "bin"]) {
        await cdp.send("Input.imeSetComposition", {
          text,
          selectionStart: text.length,
          selectionEnd: text.length,
        });
        assert(
          (await input.inputValue()) === text,
          width + "px: candidate text duplicated or lost",
        );
      }
      await page.waitForTimeout(400);
      assert(
        page.url() === before && !searches.some(Boolean),
        width + "px: searched an unconfirmed candidate",
      );
      assert(
        await row.isVisible(),
        width + "px: existing results disappeared during composition",
      );

      const confirmed = page.waitForResponse((response) =>
        response.url().includes("keyword=" + encodeURIComponent("滨")),
      );
      await cdp.send("Input.insertText", { text: "滨" });
      await confirmed;
      assert(
        (await input.inputValue()) === "滨",
        width + "px: confirmed character was lost",
      );
      assert(
        searches.filter(Boolean).join(",") === "滨",
        width + "px: " + JSON.stringify(searches),
      );
      if (desktop) {
        assert(
          page.url().includes("q=" + encodeURIComponent("滨")),
          "Missing shareable desktop keyword",
        );
        await page
          .getByRole("button", { name: "清空搜索", exact: true })
          .click();
        assert(
          (await input.inputValue()) === "" &&
            (await input.evaluate(
              (element) => document.activeElement === element,
            )),
          "Clear did not return focus to search",
        );
      } else {
        await input.fill("");
      }
      await row.waitFor();
      results.push({ width, searches });
    } finally {
      await context.close();
    }
  }
  return results;
}
