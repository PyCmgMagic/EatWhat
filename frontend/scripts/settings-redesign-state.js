async (page) => {
  const base = new URL(page.url()).origin + '/';
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage(), errors = [], checks = [];
  let user = { id: 10, displayName: '设置验收', verified: true, banned: false, role: 'user', hasPassword: true, hasUsername: true, userName: 'setting-test', phone: '13812345678' };
  let logoutRequests = 0, externalRequests = 0, logoutMode = 'failure', releaseLogout, onLogoutPending;
  p.setDefaultTimeout(8000);
  p.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(() => localStorage.setItem('eatwhat-session', JSON.stringify({ tokenName: 'x-session', tokenValue: 'isolated-settings-test' })));
  await context.route(url => !['localhost', '127.0.0.1'].includes(url.hostname), route => { externalRequests++; return route.abort(); });
  await context.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname.slice(4);
    let data = null;
    if (path === '/user/info') data = user;
    else if (path === '/remote-config') data = { configVersion: 1, flags: {}, params: {}, maintenance: { mode: 'NONE' }, announcements: [], versions: {}, update: null };
    else if (path === '/campus/list') data = [];
    else if (path === '/notification/cards/unread/count') data = { cards: 0, members: 0 };
    else if (path === '/auth/logout') {
      logoutRequests++;
      const pending = new Promise(resolve => { releaseLogout = resolve; });
      onLogoutPending?.();
      await pending;
      if (logoutMode === 'failure') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, msg: '退出未成功，请重试' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) });
  });
  const assert = (value, name) => { if (!value) throw new Error(name); };
  const home = async () => {
    await p.goto(base + '?demo=0#/settings');
    await p.getByRole('heading', { name: '设置', exact: true }).waitFor();
  };
  const reload = async () => { await p.reload(); await p.getByRole('heading', { name: '设置', exact: true }).waitFor(); };
  try {
    await home();
    await p.getByText('138****5678', { exact: true }).waitFor();
    assert(!await p.locator('.settings-home').innerText().then(text => text.includes('13812345678')), 'Phone must remain masked');
    assert(await p.locator('.settings-home-row').filter({ hasText: '手机号' }).getAttribute('href') === '#/settings/phone', 'Existing phone uses change flow');
    user = { ...user, phone: null, hasPassword: false, verified: false };
    await reload();
    assert(await p.locator('.settings-home-row').filter({ hasText: '绑定手机号' }).getAttribute('href') === '#/verify', 'First phone binding requires verified identity');
    await p.getByRole('link', { name: '设置密码 设置或更新你的登录密码 未设置', exact: true }).waitFor();
    user = { ...user, verified: true };
    await reload();
    assert(await p.locator('.settings-home-row').filter({ hasText: '绑定手机号' }).getAttribute('href') === '#/settings/bind-phone', 'Verified first binding');
    user = { ...user, verified: null, hasPassword: undefined };
    await reload();
    await p.getByText('认证状态待确认', { exact: true }).waitFor();
    assert(await p.locator('.settings-home-row').filter({ hasText: '绑定手机号' }).getAttribute('href') === '#/settings/account', 'Unknown verification must not imply unverified');
    assert(await p.locator('.settings-home-verification').count() === 0, 'No false verification prompt');
    checks.push('Known/unknown status, phone masking, binding and change-phone routing');

    await p.getByRole('button', { name: '退出登录', exact: true }).click();
    let requestPending = new Promise(resolve => { onLogoutPending = resolve; });
    await p.getByRole('button', { name: '确认退出', exact: true }).click();
    await requestPending;
    await p.getByRole('button', { name: '正在退出…', exact: true }).waitFor();
    assert(await p.getByRole('button', { name: '正在退出…', exact: true }).isDisabled(), 'Logout prevents repeated submissions');
    await p.keyboard.press('Escape');
    assert(await p.getByRole('dialog', { name: '退出当前账号？', exact: true }).isVisible(), 'Pending logout cannot be dismissed');
    assert(await p.locator('.settings-home-dialog').evaluate(el => !el.inert && !el.dataset.dismissing), 'Pending dialog must not get stuck inert');
    assert(logoutRequests === 1, 'Only one pending logout request');
    releaseLogout();
    await p.getByRole('alert').waitFor();
    assert(await p.evaluate(() => !!JSON.parse(localStorage.getItem('eatwhat-session'))), 'Logout failure preserves session');
    assert(p.url().endsWith('#/settings'), 'Failure stays on settings');
    logoutMode = 'success';
    requestPending = new Promise(resolve => { onLogoutPending = resolve; });
    await p.getByRole('button', { name: '确认退出', exact: true }).click();
    await requestPending;
    await p.getByRole('button', { name: '正在退出…', exact: true }).waitFor();
    releaseLogout();
    await p.waitForURL(url => url.hash === '#/auth');
    assert(await p.evaluate(() => JSON.parse(localStorage.getItem('eatwhat-session'))) === null, 'Successful logout clears session');
    assert(logoutRequests === 2, 'Retry sends one additional request');
    checks.push('Pending logout lock, failure preserves session, retry clears session and returns to login');
    assert(!errors.length && !externalRequests, JSON.stringify({ errors, externalRequests }));
    return { checks, logoutRequests, pageErrors: errors, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({ path: 'output/playwright/settings-state-failure.png', fullPage: true });
    throw error;
  } finally { if (releaseLogout) releaseLogout(); await context.close(); }
}
