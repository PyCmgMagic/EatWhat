async function validateNewShopEntry(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("Use the local demo server.");
  await page.goto(base + "/?demo=1&view=mobile#/publish");
  await page
    .getByRole("button", { name: "小碗菜 万达金街 1 层", exact: true })
    .click();
  await page.getByRole("link", { name: "换一家", exact: true }).click();
  await page
    .getByRole("link", { name: "没找到？新建一家店", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "添加一家店", exact: true })
    .waitFor();
  const name = page.locator('input[name="name"]');
  const search = page.getByRole("searchbox", {
    name: "搜索店名或地址",
    exact: true,
  });
  const manual = page.getByRole("button", {
    name: "搜不到？手动添加",
    exact: true,
  });
  if (await name.count()) throw new Error("应先进入搜店，选店后再填写资料。");
  const keyword = await search.inputValue();
  if (keyword !== "") throw new Error(`地图搜索应为空，实际为“${keyword}”。`);
  await manual.click();
  await page
    .getByRole("heading", { name: "填写店铺信息", exact: true })
    .waitFor();
  if ((await name.inputValue()) !== "")
    throw new Error("手动添加不应带入已选店名。");
  await name.fill("另一家新店");
  await page.getByRole("button", { name: "返回搜店", exact: true }).click();
  await search.waitFor();
  await manual.click();
  if ((await name.inputValue()) !== "另一家新店")
    throw new Error("返回搜店后丢失了同一家店的草稿。");
  await page.getByRole("button", { name: "返回搜店", exact: true }).click();
  await page.getByRole("link", { name: "返回", exact: true }).click();
  const selected = page.getByRole("button", {
    name: "小碗菜 万达金街 1 层",
    exact: true,
  });
  if ((await selected.getAttribute("aria-current")) !== "true")
    throw new Error("返回后丢失了原先选择的店铺。");
  await page
    .getByRole("link", { name: "没找到？新建一家店", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "添加一家店", exact: true })
    .waitFor();
  if ((await search.inputValue()) !== "")
    throw new Error("再次新增时带入了之前填写的新店名。");
  return {
    selectedShop: "小碗菜",
    mapKeyword: keyword,
    originalSelectionPreserved: true,
    manualDraftPreservedWhenGoingBack: true,
    repeatEntryStartsEmpty: true,
  };
}
