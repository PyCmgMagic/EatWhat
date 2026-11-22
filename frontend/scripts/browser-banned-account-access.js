// Playwright CLI run-code fixture. All API responses stay local to isolated contexts.
async (page) => {
  const base = new URL(page.url()).origin;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const results = [];
  for (const view of ['mobile', 'desktop']) {
    for (const verified of [true, false]) {
      const context = await page.context().browser().newContext({
        viewport: { width: view === 'mobile' ? 390 : 1440, height: 900 },
        isMobile: view === 'mobile', hasTouch: view === 'mobile', reducedMotion: 'reduce',
      });
      const p = await context.newPage();
      p.setDefaultTimeout(8000);
      const errors = [], requests = [];
      const user = { id: 10, displayName: '封禁账号测试', verified, banned: true, banReason: '测试封禁原因', banUntil: Date.now() + 86400000, role: 'user', hasPassword: true };
      let unread = 1;
      let appealText = '', denyPassword = false;
      p.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => {
        if (new URLSearchParams(location.search).has('guest')) localStorage.removeItem('eatwhat-session');
        else localStorage.setItem('eatwhat-session', JSON.stringify({ tokenName: 'x-session', tokenValue: 'isolated-banned-account' }));
      });
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        if (url.origin !== base) return route.abort();
        if (!path.startsWith('/api/')) return route.continue();
        requests.push({ path, method: request.method(), authenticated: request.headers()['x-session'] === 'Bearer isolated-banned-account' });
        let data = { items: [], totalItems: 0, hasNext: false };
        if (path === '/api/user/info' || path === '/api/user/userInfo') data = { ...user, uploadedFoodsCount: 0, fansCount: 0, followingsCount: 0 };
        else if (path === '/api/campus/list') data = [{ id: 1, name: '软件园', open: true, isDefault: true }];
        else if (path === '/api/remote-config') data = { configVersion: 1, flags: {}, params: {}, maintenance: { mode: 'NONE' }, announcements: [], versions: {} };
        else if (path === '/api/user/activity') data = { firstUseToday: false, experienceAdded: 0 };
        else if (path === '/api/notification/cards/unread/count') data = { cards: unread, members: unread };
        else if (path === '/api/notification/cards') data = { items: [{
          id: 101, kind: 'account_banned', column: 'SYSTEM', latestAt: Date.now(),
          memberCount: 1, unreadMemberCount: unread, actors: [],
          data: { type: 'account_banned', reason: '测试封禁原因' },
        }], hasNext: false };
        else if (path === '/api/notification/cards/read-all') { unread = 0; data = null; }
        else if (path === '/api/feedback/messages') {
          appealText = request.postDataJSON().text;
          data = { id: 88, duplicate: false };
        } else if (path === '/api/feedback/mine/88') data = { id: 88, kind: 'FEEDBACK', category: 'OTHER', status: 'OPEN', text: appealText, createdAt: Date.now(), screenshots: [] };
        else if (path === '/api/auth/changePassword') {
          if (denyPassword) return route.fulfill({ status: 200, json: { code: 30002, msg: '服务端暂不允许此操作' } });
          data = null;
        } else if (path === '/api/auth/sessions') data = { devices: [], nextCursor: null };
        else if (path === '/api/auth/sessions/revoke-others') data = null;
        else if (path === '/api/user/followings' || path === '/api/user/followers') data = { items: [], totalItems: 0, hasNext: false };
        return route.fulfill({ status: 200, json: { code: 0, data } });
      });
      const visit = path => p.goto(base + '/?demo=0&view=' + view + '#' + path);
      const profile = () => p.getByRole('heading', { name: view === 'mobile' ? user.displayName : '最近上传', exact: true }).first();
      try {
        // Use the main navigation, then check that a reload keeps access.
        await visit('/');
        await p.getByRole('link', { name: '我的', exact: true }).click();
        await profile().waitFor();
        assert(await p.getByText('账号暂时无法使用', { exact: true }).filter({ visible: true }).count() === 0, view + ': profile is blocked');
        if (view === 'mobile') {
          for (const name of ['收藏', '赞过', '上传']) {
            await p.getByRole('tab', { name, exact: true }).click();
            await p.getByRole('tabpanel', { name, exact: true }).waitFor();
          }
        }
        await p.reload();
        await profile().waitFor();
        await p.screenshot({ path: 'output/playwright/banned-' + view + '-profile-' + verified + '.png', fullPage: true });
        const restriction = p.getByRole('region', { name: '账号受限状态' });
        await restriction.getByText('测试封禁原因', { exact: true }).waitFor();
        await restriction.getByRole('link', { name: '申诉', exact: true }).click();
        await p.getByRole('heading', { name: '账号申诉', exact: true }).waitFor();
        await p.getByRole('textbox', { name: '申诉说明', exact: true }).fill('请复核这次账号限制。');
        await p.getByRole('button', { name: '提交申诉', exact: true }).click();
        await p.waitForURL(url => url.hash === '#/feedback/mine/88');
        await p.getByText('【账号申诉】 请复核这次账号限制。', { exact: true }).waitFor();
        assert(appealText === '【账号申诉】 请复核这次账号限制。', 'Appeal did not reach existing feedback API');

        for (const path of ['/favorites', '/likes', '/history', '/me/shares?tab=comments', '/settings', '/settings/account', '/settings/privacy', '/settings/notifications', '/feedback/mine']) {
          await visit(path);
          await p.waitForFunction(() => !document.querySelector('.mobile-page-skeleton'));
          assert(await p.getByRole('heading', { name: '账号暂时无法使用', exact: true }).count() === 0, view + ': blocked ' + path);
        }
        await visit('/settings/password');
        const password = p.getByRole('form', { name: '修改密码表单' });
        await password.getByLabel('当前密码', { exact: true }).fill('old-fixture-password');
        await password.getByLabel('新密码', { exact: true }).fill('new-fixture-password');
        await password.getByLabel('再次输入新密码', { exact: true }).fill('new-fixture-password');
        await password.getByRole('button', { name: '更新密码', exact: true }).click();
        await p.getByText('密码已更新。', { exact: true }).waitFor();
        // API rejections remain visible; a front-end exception never overrides the server.
        denyPassword = true;
        await password.getByLabel('当前密码', { exact: true }).fill('new-fixture-password');
        await password.getByLabel('新密码', { exact: true }).fill('third-fixture-password');
        await password.getByLabel('再次输入新密码', { exact: true }).fill('third-fixture-password');
        await password.getByRole('button', { name: '更新密码', exact: true }).click();
        await p.getByText('服务端暂不允许此操作', { exact: true }).waitFor();
        await p.getByRole('button', { name: '关闭提示', exact: true }).click();
        await visit('/settings/devices');
        await p.getByRole('button', { name: '下线其他设备', exact: true }).click();
        await p.getByRole('dialog').getByRole('button', { name: '确认下线', exact: true }).click();
        await p.getByText('已下线其他设备', { exact: true }).waitFor();

        // The account's system message remains readable and can be marked read.
        await visit('/');
        await p.getByRole('link', { name: view === 'mobile' ? /^消息通知/ : /^通知/ }).click();
        await p.getByText(/测试封禁原因/).waitFor();
        const system = p.getByRole(view === 'mobile' ? 'tab' : 'button', { name: '系统', exact: true });
        await system.click();
        await p.getByText(/测试封禁原因/).waitFor();
        const readAll = p.getByRole('button', { name: '全部已读', exact: true });
        await readAll.click();
        await p.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '全部已读' && button.disabled));
        assert(unread === 0 && requests.some(r => r.path === '/api/notification/cards/read-all'), 'Mark read is blocked');
        assert(requests.filter(r => r.path === '/api/notification/cards').every(r => r.authenticated), 'Messages lost authentication');
        await p.screenshot({ path: 'output/playwright/banned-' + view + '-notifications-' + verified + '.png', fullPage: true });

        for (const restricted of ['/publish/dish', '/me/edit']) {
          await visit(restricted);
          await p.getByRole('heading', { name: '账号暂时无法使用', exact: true }).waitFor();
          await p.getByText('测试封禁原因', { exact: true }).filter({ visible: true }).waitFor();
        }
        assert(!requests.some(r => r.method !== 'GET' && /\/food\/|\/user\/update|\/user\/follow/.test(r.path)), 'Restricted action was sent');

        // Unbanning the same account must restore its normal entry behavior.
        user.banned = false;
        await visit('/me');
        await p.reload();
        await profile().waitFor();
        if (verified) {
          await visit('/me/edit');
          await p.getByRole('textbox').first().waitFor();
          assert(await p.getByText('账号暂时无法使用', { exact: true }).filter({ visible: true }).count() === 0, 'Normal account stays blocked');
        }
        for (const protectedPage of view === 'mobile' ? ['/me', '/notifications'] : ['/me']) {
          const requestCount = requests.length;
          await p.goto(base + '/?demo=0&view=' + view + '&guest=1#' + protectedPage);
          if (view === 'mobile') await p.waitForURL(url => url.hash.startsWith('#/auth'));
          else await p.getByRole('dialog').waitFor();
          assert(!requests.slice(requestCount).some(r => r.path === '/api/user/info' || r.path === '/api/notification/cards'), 'Guest fetched account content');
        }
        assert(errors.length === 0, errors.join('; '));
        results.push({ view, verified, profile: 'passed', notifications: 'passed', readAll: 'passed', appeal: 'passed', security: 'passed', serverDenial: 'passed', restrictedRoutes: 'passed', normalAccount: 'passed', loginRequired: 'passed' });
      } catch (error) {
        await p.screenshot({ path: 'output/playwright/banned-' + view + '-failure.png', fullPage: true });
        throw error;
      } finally { await context.close(); }
    }
  }
  return results;
}
