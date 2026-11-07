async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await context.newPage(), checks = [], errors = [], outside = [], writes = [];
  p.setDefaultTimeout(8000);
  p.on('pageerror', e => errors.push(e.message));
  await context.route(u => u.hostname !== '127.0.0.1' && u.hostname !== 'localhost', r => {
    outside.push(r.request().url()); return r.abort();
  });
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const rows = () => p.locator('.status-list').evaluate(el => Object.fromEntries(
    [...el.querySelectorAll('div')].map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]),
  ));
  const ensureOpen = async () => {
    const summary = p.getByText('查看与管理授权', { exact: true });
    if (!await summary.evaluate(el => el.closest('details').open)) await summary.click();
  };
  const open = async () => {
    await ensureOpen();
    await p.locator('.status-list').waitFor();
  };
  const settle = () => p.evaluate(async () => {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
  });
  const statusData = () => p.evaluate(async () => {
    const { demoTransport } = await import('/src/demo/transport.ts');
    return (await demoTransport('/auth/consent', {})).data;
  });
  let result;
  try {
    await context.route(u => u.pathname.startsWith('/api/'), r => r.abort());
    await p.goto('http://127.0.0.1:5173/?demo=1&view=desktop#/settings/account');
    await open();
    const mockStatus = await statusData();
    assert(JSON.stringify(Object.keys(mockStatus).sort()) === JSON.stringify(['identityReady', 'policyVersion', 'status']), 'Mock 查询没有严格返回三字段');
    const initial = await rows();
    assert(initial['授权状态'] === 'NOT_GRANTED' && initial['身份已就绪'] === '否', '无记录时没有显示未授权状态');
    assert(!('注册已接受' in initial), '授权面板仍读取已移除字段');
    checks.push('Mock 无记录三字段查询及正确的未授权展示');
    // Replace the mock-only network guard with a complete isolated real-mode API.
    await context.unrouteAll({ behavior: 'wait' });
    await context.route(u => u.hostname !== '127.0.0.1' && u.hostname !== 'localhost', r => {
      outside.push(r.request().url()); return r.abort();
    });
    await context.addInitScript(() => localStorage.setItem('eatwhat-session', JSON.stringify({ tokenName: 'x-session', tokenValue: 'isolated-v3' })));
    let status = { status: 'GRANTED', identityReady: true, policyVersion: 'accepted-policy-v2' }, failStatus = false;
    const currentVersion = 'current-policy-v3';
    const reply = (r, data, httpStatus = 200) => r.fulfill({
      status: httpStatus, contentType: 'application/json',
      body: JSON.stringify({ code: httpStatus === 200 ? 0 : httpStatus, data, msg: httpStatus === 200 ? 'ok' : '状态读取失败', timestamp: Date.now() }),
    });
    await context.route(u => u.pathname.startsWith('/api/'), async r => {
      const path = new URL(r.request().url()).pathname;
      if (path === '/api/user/info') return reply(r, {
        id: 10, displayName: '接口测试食友', userName: 'student', hasUsername: true, hasPassword: true,
        role: 'user', verified: true, banned: false,
      });
      if (path === '/api/notification/unread/count') return reply(r, 0);
      if (path === '/api/auth/consent/policy') return reply(r, { version: currentVersion, url: '/api/policies/current.html' });
      if (path === '/api/policies/current.html') return r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><main><h1>隔离测试政策 ${currentVersion}</h1><p>仅用于本地验证，不发送真实授权。</p></main>` });
      if (path === '/api/auth/consent') {
        assert(r.request().headers()['x-session'] === 'Bearer isolated-v3', '查询未保留真实模式会话头');
        return reply(r, failStatus ? null : status, failStatus ? 503 : 200);
      }
      if (path === '/api/auth/consent/grant' || path === '/api/auth/consent/withdraw') {
        assert(r.request().method() === 'POST', '授权动作方法错误');
        writes.push(path);
        if (path.endsWith('grant')) {
          assert(r.request().postDataJSON().policyVersion === currentVersion, '重新授权没有使用当前政策版本');
          status = { status: 'GRANTED', identityReady: true, policyVersion: currentVersion };
        } else status = { status: 'WITHDRAWN', identityReady: false, policyVersion: currentVersion };
        return reply(r, { ...status, registrationAccepted: true, backfillStatus: 'NOT_STARTED', cleanupStatus: path.endsWith('grant') ? 'NOT_REQUIRED' : 'COMPLETED' });
      }
      if (path === '/api/user/blocks') return reply(r, { items: [], currentPage: 1, totalPages: 0, totalItems: 0, hasNext: false });
      return reply(r, null, 404);
    });
    await p.goto('http://127.0.0.1:5173/?demo=0&view=desktop#/settings/account');
    await open();
    const actual = await rows();
    assert(actual['授权政策版本'] === 'accepted-policy-v2' && actual['当前政策版本'] === currentVersion, '授权记录版本与当前版本未分别显示');
    assert(!('注册已接受' in actual) && actual['身份已就绪'] === '是', '真实三字段状态显示错误');
    await p.getByRole('button', { name: '管理授权', exact: true }).click();
    await p.getByRole('checkbox', { name: '我已阅读并同意跨站同步授权政策', exact: true }).check();
    await p.getByRole('button', { name: '同意并授权', exact: true }).click();
    await p.waitForFunction(version => [...document.querySelectorAll('.status-list dt')].find(el => el.textContent === '授权政策版本')?.nextElementSibling.textContent === version, currentVersion);
    await p.getByRole('button', { name: '撤回当前授权', exact: true }).click();
    await p.getByRole('button', { name: '确认撤回授权', exact: true }).click();
    await p.waitForFunction(() => document.querySelector('.status-list dd')?.textContent === 'WITHDRAWN');
    assert((await rows())['身份已就绪'] === '否', '撤回后没有重新读取三字段状态');
    checks.push('真实适配层三字段响应、两个政策版本、六字段授权/撤回响应及查询刷新');
    const layouts = [];
    for (const width of [320, 390, 820, 1440]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto(`http://127.0.0.1:5173/?demo=0&view=${width < 600 ? 'mobile' : 'desktop'}#/settings/account`);
      await open(); await settle();
      const values = await rows();
      assert(!('注册已接受' in values) && values['授权状态'] === 'WITHDRAWN', '响应式授权面板仍使用旧字段');
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '授权面板横向溢出：' + width);
      layouts.push(width);
      if (width === 390 || width === 1440) await p.screenshot({ path: `output/playwright/api-v3-consent-${width}.png`, fullPage: true });
    }
    checks.push('320 / 390 / 820 / 1440px 授权面板和宽度检查');
    failStatus = true;
    await p.reload();
    await ensureOpen();
    await p.getByText('状态读取失败', { exact: true }).waitFor();
    assert(await p.locator('.status-list').count() === 0, '读取失败被展示成否定状态');
    failStatus = false;
    await p.getByRole('button', { name: '重新加载', exact: true }).click();
    await p.locator('.status-list').waitFor();
    assert((await rows())['授权状态'] === 'WITHDRAWN', '授权状态读取重试失败');
    checks.push('503 状态失败展示及重试恢复，无假定状态');
    await p.goto('http://127.0.0.1:5173/?demo=0&view=desktop#/settings/blocked');
    await p.getByRole('heading', { name: '目前没有屏蔽的食友', exact: true }).waitFor();
    checks.push('已部署屏蔽列表的真实适配层成功响应');
    assert(errors.length === 0 && outside.length === 0, '页面异常或外部请求：' + JSON.stringify({ errors, outside }));
    result = { checks, layouts, interceptedWrites: writes.length, pageErrors: errors, realExternalRequests: outside.length };
    await page.evaluate(result => sessionStorage.setItem('eatwhat-qa-api-v3', JSON.stringify(result)), result);
    return result;
  } catch (error) {
    await p.screenshot({ path: 'output/playwright/api-v3-consent-failure.png', fullPage: true });
    throw error;
  } finally {
    await context.close();
  }
}
