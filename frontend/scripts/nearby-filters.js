async function validateNearbyFilters(page) {
  const origin = new URL(page.url()).origin;
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
  const phone = await context.newPage();
  phone.setDefaultTimeout(10000);
  const sheet = phone.getByRole("dialog", { name: "筛选", exact: true });
  const open = () => phone.getByRole("button", { name: /^筛选店铺/ }).click();
  const show = (count) =>
    sheet.getByRole("button", { name: `看 ${count} 家`, exact: true });
  const heading = (count) =>
    phone.getByRole("heading", { name: `附近 ${count}`, exact: true });
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const errors = [];
  const visits = [];
  phone.on("framenavigated", (frame) => {
    if (frame === phone.mainFrame()) visits.push(new URL(frame.url()).hash);
  });
  phone.on("pageerror", (error) => errors.push(error.message));
  try {
    await phone.goto(origin + "/?demo=1#/nearby");
    await heading(7).waitFor();
    await open();
    await sheet.getByRole("radio", { name: "美食", exact: true }).check();
    await sheet.getByRole("checkbox", { name: "粉面" }).check();
    await sheet.getByRole("checkbox", { name: "米饭炒菜" }).check();
    await show(3).waitFor();
    await sheet.getByRole("radio", { name: "15–30 元" }).check();
    await sheet.getByRole("switch", { name: "只看口碑好的" }).check();
    await show(2).waitFor();
    assert(
      (await phone.locator(".mobile-nearby-shop").count()) === 7,
      "Draft changed the list",
    );
    await show(2).click();
    await heading(2).waitFor();
    const rows = await phone
      .locator(".mobile-nearby-shop strong")
      .allTextContents();
    assert(
      rows.join(",") === "小碗菜,螺蛳粉研究所",
      "Wrong matching shops: " + rows,
    );
    await phone.waitForFunction(
      () =>
        [...document.querySelectorAll(".restaurant-map-marker")].reduce(
          (sum, marker) => sum + Number(marker.dataset.count),
          0,
        ) === 2,
    );
    await open();
    await sheet.getByRole("button", { name: "重置" }).click();
    await show(7).waitFor();
    await phone.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached" });
    await heading(2).waitFor();
    assert(
      await phone
        .locator(".nearby-filter-trigger")
        .evaluate((el) => el === document.activeElement),
      "Focus was lost on cancel",
    );
    await open();
    assert(
      await sheet.getByRole("checkbox", { name: "粉面" }).isChecked(),
      "Cancel discarded the applied categories",
    );
    await sheet.getByRole("radio", { name: "自助" }).check();
    await show(0).click();
    await phone.getByRole("heading", { name: "没有符合条件的店铺" }).waitFor();
    await phone.getByRole("button", { name: "调整筛选" }).click();
    await sheet.getByRole("button", { name: "重置" }).click();
    await sheet.getByRole("switch", { name: "只看我收藏的店" }).check();
    await sheet.getByRole("button", { name: /^看 \d+ 家$/ }).click();
    assert(
      new URLSearchParams(phone.url().split("#")[1].split("?")[1]).get(
        "favorites",
      ) === "1",
      "Favorites missing from applied filters",
    );
    await open();
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [430, 932],
    ]) {
      await phone.setViewportSize({ width, height });
      const bounds = await sheet.boundingBox();
      const footer = await sheet.locator("footer").boundingBox();
      assert(
        bounds.x >= 0 &&
          bounds.x + bounds.width <= width + 1 &&
          footer.y + footer.height <= height + 1,
        "Sheet overflows " + width,
      );
      await sheet
        .getByRole("switch", { name: "只看我收藏的店" })
        .scrollIntoViewIfNeeded();
    }
    await sheet.getByRole("button", { name: "重置" }).click();
    await show(7).click();
    await sheet.waitFor({ state: "detached" });
    await phone.getByRole("searchbox", { name: "搜店名或地址" }).fill("银座");
    await heading(1).waitFor();
    await open();
    await sheet.getByRole("radio", { name: "30 元以上" }).check();
    await show(1).click();
    await phone.getByRole("link", { name: "查看香锅小站" }).click();
    await phone.waitForURL((url) => url.hash === "#/restaurants/6");
    await phone.goBack();
    await heading(1).waitFor();
    assert(
      (await phone.getByRole("searchbox").inputValue()) === "银座",
      "Lost the keyword after returning",
    );
    await open();
    assert(
      await sheet.getByRole("radio", { name: "30 元以上" }).isChecked(),
      "Lost the price after returning",
    );
    assert(!errors.length, errors.join("\n"));
    return { rows, sizes: [320, 390, 430], errors };
  } catch (error) {
    throw new Error(
      `${error.message}\n${visits.slice(-5).join("\n")}\n${phone.url()}\n${(await phone.locator("body").innerText()).slice(0, 800)}`,
    );
  } finally {
    await context.close();
  }
}
