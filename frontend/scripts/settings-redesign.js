async (page) => {
  const base = new URL(page.url()).origin + '/';
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const p = await context.newPage(), errors = [], requests = [], layouts = [], checks = [];
  p.setDefaultTimeout(8000);
  p.on('pageerror', error => errors.push(error.message));
  p.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await context.route(url => !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname.startsWith('/api/'), route => { requests.push(route.request().url()); return route.abort(); });
  const assert = (value, name) => { if (!value) throw new Error(name); };
  const settle = async () => {
    await p.waitForFunction(() => !!document.querySelector('.pc-app') === (innerWidth >= 600) && document.querySelector('.settings-home'));
    await p.getByRole('heading', { name: '设置', exact: true }).waitFor();
    await p.evaluate(async () => { await document.fonts.ready; });
  };
  try {
    await p.goto(base + '?demo=1&persona=unverified#/settings');
    await settle();
    assert(await p.locator('.settings-home-row').count() === 13, 'All settings links are present');
    assert(await p.locator('.ew-access').count() === 0, 'Unverified user can access settings');
    for (const width of [320, 390, 600, 820, 1024, 1440, 1920]) {
      await p.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      await settle();
      const layout = await p.evaluate(() => {
        const targets = [...document.querySelectorAll('.settings-home-row, .settings-home-edit, .settings-home-all, .settings-home-logout')].map(el => el.getBoundingClientRect());
        return { width: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth, minTargetHeight: Math.min(...targets.map(rect => rect.height)), clipped: targets.some(rect => rect.left < 0 || rect.right > innerWidth + 1) };
      });
      assert(layout.overflow <= 1 && !layout.clipped, 'Layout overflow at ' + width);
      assert(layout.minTargetHeight >= 44, 'Tap target too small at ' + width);
      layouts.push(layout);
      if (width === 390 || width === 1440) await p.screenshot({ path: 'output/playwright/settings-redesign-' + (width === 390 ? 'mobile' : 'desktop') + '.png', fullPage: true });
    }
    for (const width of [390, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      await settle();
      await p.locator('.settings-home-row').filter({ hasText: '账号信息' }).click();
      await p.getByRole('heading', { name: '账号与安全', exact: true }).waitFor();
      assert(await p.locator('.ew-access').count() === 0, 'Account should not require student verification');
      await p.goBack(); await settle();
      await p.locator('.settings-home-row[href="#/settings/password"]').click();
      await p.getByRole('heading', { name: '设置密码', exact: true }).waitFor();
      assert(await p.locator('.ew-access').count() === 0, 'Password should not require student verification');
      await p.goBack(); await settle();
      await p.locator('.settings-home-row[href="#/verify"]').click();
      await p.getByRole('heading', { name: '学生认证', exact: true }).waitFor();
      assert(await p.locator('.ew-access').count() === 0, 'Verification entry must remain accessible');
      await p.goBack(); await settle();
      const previousOverflow = await p.evaluate(() => document.body.style.overflow);
      await p.getByRole('button', { name: '退出登录', exact: true }).click();
      await p.getByRole('dialog', { name: '退出当前账号？', exact: true }).waitFor();
      await p.getByRole('button', { name: '取消', exact: true }).click();
      await p.getByRole('dialog', { name: '退出当前账号？', exact: true }).waitFor({ state: 'detached' });
      assert(await p.evaluate(() => document.body.style.overflow) === previousOverflow, 'Scroll lock is restored');
      await p.getByRole('button', { name: '退出登录', exact: true }).click();
      await p.getByRole('dialog', { name: '退出当前账号？', exact: true }).waitFor();
      await p.keyboard.press('Escape');
      await p.getByRole('dialog', { name: '退出当前账号？', exact: true }).waitFor({ state: 'detached' });
      assert(await p.getByRole('button', { name: '退出登录', exact: true }).evaluate(el => el === document.activeElement), 'Dialog restores focus');
    }
    checks.push('Unverified account/password/verification navigation on mobile and desktop', 'Logout cancel, Escape, focus restoration and scroll lock');
    await p.goto(base + '?demo=1#/settings'); await settle();
    await p.getByText('学生身份已认证', { exact: true }).waitFor();
    assert(await p.locator('.settings-home-verification').count() === 0, 'Verified user has no completion prompt');
    checks.push('Verified account status');
    assert(!errors.length && !requests.length, JSON.stringify({ errors, requests }));
    return { checks, layouts, pageErrors: errors, realApiRequests: requests.length };
  } catch (error) {
    await p.screenshot({ path: 'output/playwright/settings-redesign-failure.png', fullPage: true });
    throw error;
  } finally { await context.close(); }
}
