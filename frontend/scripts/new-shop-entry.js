async function validateNewShopEntry(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("Use the local demo server.");
  await page.goto(base + "/?demo=1&view=mobile#/publish");
  await page
    .getByRole("radio", { name: "小碗菜 万达金街 1 层", exact: true })
    .click();
  await page
    .getByRole("link", { name: "没找到？新建一家店", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "添加一家店", exact: true })
    .waitFor();
  const name = await page.locator('input[name="name"]').inputValue();
  if (name !== "") throw new Error(`新建店铺店名应为空，实际为“${name}”。`);
  const keyword = await page
    .getByRole("searchbox", { name: "搜索店名或地址", exact: true })
    .inputValue();
  if (keyword !== "") throw new Error(`地图搜索应为空，实际为“${keyword}”。`);
  await page.locator('input[name="name"]').fill("另一家新店");
  await page.getByRole("link", { name: "返回", exact: true }).click();
  const selected = page.getByRole("radio", {
    name: "小碗菜 万达金街 1 层",
    exact: true,
  });
  if ((await selected.getAttribute("aria-checked")) !== "true")
    throw new Error("返回后丢失了原先选择的店铺。");
  await page
    .getByRole("link", { name: "没找到？新建一家店", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "添加一家店", exact: true })
    .waitFor();
  if ((await page.locator('input[name="name"]').inputValue()) !== "")
    throw new Error("再次新增时带入了之前填写的新店名。");
  return {
    selectedShop: "小碗菜",
    newShopName: name,
    mapKeyword: keyword,
    originalSelectionPreserved: true,
    repeatEntryStartsEmpty: true,
  };
}
