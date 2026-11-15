async function validateResponsiveProfile(browserPage) {
  const origin = await browserPage.evaluate(() => location.origin);
  const context = await browserPage
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const button = (name) => page.getByRole("button", { name, exact: true });
  const nickname = page.locator("#nick");
  const signature = page.locator("#sign");
  const desktop = page.locator(".pc-profile-editor");
  const mobile = page.locator(".mobile-profile-editor");
  const birthday = page.locator("#profile-birthday");
  const base = origin + "/?demo=1";
  const name = "今天好好吃饭";
  const sign = "今天想吃一碗热汤";
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  async function resize(width, editor) {
    await page.setViewportSize({ width, height: 844 });
    await editor.waitFor();
  }

  try {
    await page.goto(base + "#/me/edit");
    await desktop.waitFor();
    await nickname.fill(name);
    await birthday.fill("2002-09-14");
    await page
      .locator('input[type="file"]')
      .setInputFiles("frontend/public/prototype/assets/photos/sq_luosi.png");
    await button("使用这个头像").click();
    const draftAvatar = await page.getByAltText("头像预览").getAttribute("src");
    assert(draftAvatar?.startsWith("blob:"), "Missing desktop avatar draft");

    await resize(639, mobile);
    assert(
      (await desktop.count()) === 0,
      "Desktop editor stayed mounted at 639 px",
    );
    assert(
      (await nickname.inputValue()) === name,
      "Desktop nickname draft was lost",
    );
    assert(
      (await birthday.inputValue()) === "2002-09-14",
      "Desktop birthday draft was lost",
    );
    assert(
      (await mobile
        .locator(".mobile-profile-avatar-button img")
        .getAttribute("src")) === draftAvatar,
      "Desktop avatar draft was lost",
    );
    await mobile.getByLabel("换头像", { exact: true }).click();
    const chooser = page.getByRole("dialog", { name: "更换头像" });
    await chooser
      .getByRole("button", { name: "从相册选", exact: true })
      .waitFor();
    await chooser
      .locator("header")
      .getByRole("button", { name: "关闭头像选项" })
      .click();
    await chooser.waitFor({ state: "hidden" });
    await signature.fill(sign);

    await resize(640, desktop);
    assert(
      (await mobile.count()) === 0,
      "Mobile editor stayed mounted at 640 px",
    );
    assert(
      (await signature.inputValue()) === sign,
      "Mobile signature draft was lost",
    );
    assert(
      (await page.getByAltText("头像预览").getAttribute("src")) === draftAvatar,
      "Avatar draft changed after a round trip",
    );
    await resize(390, mobile);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Mobile editor overflows at 390 px",
    );
    await button("保存").click();
    await page.waitForURL((url) => url.hash === "#/me");
    await page.goto(base + "#/me/edit");
    await mobile.waitFor();
    assert((await nickname.inputValue()) === name, "Nickname was not saved");
    assert((await signature.inputValue()) === sign, "Signature was not saved");
    assert(
      (await birthday.inputValue()) === "2002-09-14",
      "Birthday was not saved",
    );
    await mobile.locator(".mobile-profile-avatar-button img").waitFor();
    assert(
      (await button("撤销头像更换").count()) === 0,
      "Saved avatar remained a draft",
    );

    await resize(1440, desktop);
    await page.goto(base + "#/me/details");
    await desktop.waitFor();
    await resize(390, mobile);
    await page.waitForURL((url) => url.hash === "#/me/edit");

    await page.goto(base + "&view=desktop#/me/edit");
    await desktop.waitFor();
    await page.goto(base + "&view=mobile#/me/edit");
    await resize(1440, mobile);
    assert(errors.length === 0, errors.join("\n"));
    return {
      checks: [
        "desktop → mobile at 639 px → desktop at 640 px",
        "unsaved text, birthday and avatar preview survive",
        "mobile avatar chooser and save/readback work",
        "legacy route and explicit previews work",
      ],
    };
  } finally {
    await context.close();
  }
}
