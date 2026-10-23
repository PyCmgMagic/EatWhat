async (page) => {
  const origin = "http://127.0.0.1:5173";
  const checks = [];
  await page.goto(origin + "/?demo=1#/foods/1");
  await page
    .getByRole("heading", { name: "溏心蛋豚骨拉面", exact: true })
    .waitFor();
  const wasSaved = await page
    .getByRole("button", { name: "已收藏", exact: true })
    .count();
  await page
    .getByRole("button", {
      name: wasSaved ? "已收藏" : "收藏这道菜",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: wasSaved ? "收藏这道菜" : "已收藏",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", {
      name: wasSaved ? "收藏这道菜" : "已收藏",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: wasSaved ? "已收藏" : "收藏这道菜",
      exact: true,
    })
    .waitFor();
  checks.push("favorite roundtrip");
  await page
    .getByRole("button", { name: "给这道菜做分类", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "新分类名称" })
    .fill("浏览器验收分类");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await page
    .getByRole("button", { name: "移除分类浏览器验收分类", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "热乎一碗", exact: true }).click();
  await page
    .getByRole("button", { name: "热乎一碗 · 撤销我的标记", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "热乎一碗 · 撤销我的标记", exact: true })
    .click();
  await page.getByRole("button", { name: "热乎一碗", exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  checks.push("personal and public tags");
  await page.goto(origin + "/?demo=1#/favorites");
  await page
    .getByRole("button", { name: "管理分类浏览器验收分类", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "管理分类浏览器验收分类", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "分类名称", exact: true })
    .fill("验收分类已改名");
  await page.getByRole("button", { name: "保存名称", exact: true }).click();
  await page
    .getByRole("button", { name: "管理分类验收分类已改名", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "管理分类验收分类已改名", exact: true })
    .click();
  await page.getByRole("button", { name: "删除分类", exact: true }).click();
  await page.getByRole("button", { name: "确认删除分类", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  checks.push("rename and delete personal tags");
  await page.goto(origin + "/?demo=1#/restaurants/1");
  await page
    .getByRole("heading", { name: "一食堂 · 日式面档", exact: true })
    .waitFor();
  await page.getByLabel("按口味找店内菜品").selectOption({ label: "热乎一碗" });
  await page
    .getByRole("link", { name: "查看溏心蛋豚骨拉面", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "分享这里的一道菜", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "菜品名称", exact: true })
    .fill("浏览器验收·清汤面");
  await page
    .getByRole("button", { name: "分享这份好味道", exact: true })
    .click();
  await page.getByText("请至少选择一张菜品图片。", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "使用一张演示照片体验", exact: true })
    .click();
  await page.getByAltText("待分享图片1").waitFor();
  await page.getByLabel("价格 选填").fill("0");
  await page
    .getByRole("button", { name: "分享这份好味道", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "这一份好味道，已存入本地演示", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "去我的分享", exact: true }).click();
  await page
    .getByRole("link", { name: "查看浏览器验收·清汤面", exact: true })
    .waitFor();
  checks.push("restaurant filter, publish validation, zero price and my foods");
  await page.goto(origin + "/?demo=1&persona=admin#/admin");
  await page.getByText("认证比例原始值：").waitFor();
  await page.getByRole("button", { name: "菜品维护", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "餐厅编号", exact: true })
    .fill("1");
  await page.getByRole("button", { name: "读取店内菜品", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "浏览器验收·清汤面" });
  await row.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认操作", exact: true }).click();
  await row.waitFor({ state: "hidden" });
  checks.push("administrator deletes only the test item");
  await page.goto(origin + "/?demo=1&persona=unverified#/favorites");
  await page
    .getByRole("heading", { name: "先认识一下，同校的你", exact: true })
    .waitFor();
  checks.push("verified gate");
  await page.goto(origin + "/?demo=1#/admin");
  await page
    .getByRole("heading", { name: "这里需要管理员身份", exact: true })
    .waitFor();
  checks.push("admin gate");
  await page.goto(origin + "/?demo=1#/settings");
  await page
    .getByRole("button", { name: "关注关系可见性", exact: true })
    .click();
  const visible = page.getByRole("checkbox", {
    name: "允许其他同学查看我的关注",
    exact: true,
  });
  const original = await visible.isChecked();
  await visible.setChecked(!original);
  await page.getByRole("button", { name: "保存可见性", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "关注关系可见性", exact: true })
    .click();
  if ((await visible.isChecked()) === original)
    throw new Error("privacy did not persist");
  await visible.setChecked(original);
  await page.getByRole("button", { name: "保存可见性", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  checks.push("privacy read-write-read roundtrip");
  await page.goto(origin + "/?demo=1");
  return { passed: checks };
}
