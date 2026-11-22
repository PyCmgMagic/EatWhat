// Playwright CLI run-code fixture: local responses only, no real read/follow writes.
async (page) => {
  const base = new URL(page.url()).origin;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const results = [];
  for (const width of [320, 390, 520]) {
    const context = await page.context().browser().newContext({
      viewport: { width, height: 844 }, isMobile: true, hasTouch: true,
      timezoneId: 'Asia/Taipei', reducedMotion: width === 520 ? 'reduce' : 'no-preference',
    });
    const p = await context.newPage();
    p.setDefaultTimeout(8000);
    const errors = [], reads = [], follows = [], columns = [];
    const unread = new Set([101, 103, 105]);
    const following = new Map([[30, true], [31, true]]);
    let failAll = true, failList = false, allCalls = 0;
    const now = Date.now(), hour = 3600000, day = 24 * hour;
    const cards = [
      { id: 101, kind: 'new_device_login', column: 'SYSTEM', latestAt: now, data: { type: 'new_device_login', device: 'ANDROID', deviceName: 'V2309A' } },
      { id: 102, kind: 'follow', column: 'FOLLOWS', latestAt: now - 10 * hour, actors: [{ id: 30, displayName: 'FooFish' }] },
      { id: 103, kind: 'content_removed', column: 'SYSTEM', latestAt: now - 11 * hour, data: { type: 'content_removed', title: '123', reason: '删除测试数据' } },
      { id: 104, kind: 'follow', column: 'FOLLOWS', latestAt: now - day, actors: [{ id: 31, displayName: 'Maycry' }] },
      { id: 105, kind: 'comment', column: 'COMMENTS', latestAt: now - day - hour, actors: [{ id: 32, displayName: 'Apple 审核' }], target: { domain: 'foods', id: 7 } },
      { id: 106, kind: 'new_device_login', column: 'SYSTEM', latestAt: now - 2 * day, data: { type: 'new_device_login', device: 'WEB' } },
    ];
    p.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => localStorage.setItem('eatwhat-session', JSON.stringify({ tokenName: 'x-session', tokenValue: 'isolated-inbox-preview' })));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      if (url.origin !== base) return route.abort();
      if (!path.startsWith('/api/')) return route.continue();
      let data = { items: [], totalItems: 0, hasNext: false };
      if (path === '/api/user/info') data = { id: 10, displayName: '消息测试', verified: true, banned: false, role: 'user' };
      else if (path === '/api/campus/list') data = [{ id: 1, name: '软件园', open: true, isDefault: true }];
      else if (path === '/api/remote-config') data = { configVersion: 1, flags: {}, params: {}, maintenance: { mode: 'NONE' }, announcements: [], versions: {} };
      else if (path === '/api/user/activity') data = { firstUseToday: false, experienceAdded: 0 };
      else if (path === '/api/notification/cards/unread/count') data = { cards: unread.size, members: unread.size };
      else if (path === '/api/notification/cards') {
        if (failList) return route.fulfill({ status: 400, json: { code: 400, msg: '消息暂时无法加载' } });
        const column = url.searchParams.get('column') ?? 'ALL';
        columns.push(column);
        data = { items: cards.filter(item => column === 'ALL' || item.column === column).map(item => ({ memberCount: 1, actors: [], ...item, unreadMemberCount: unread.has(item.id) ? 1 : 0 })), hasNext: false };
      } else if (path === '/api/notification/cards/read-all') {
        allCalls++;
        if (failAll) return route.fulfill({ status: 400, json: { code: 400, msg: '标记失败，请重试' } });
        unread.clear(); data = null;
      } else if (/\/notification\/cards\/\d+\/read$/.test(path)) {
        const id = Number(path.split('/').at(-2));
        reads.push(id); unread.delete(id); data = null;
      } else if (path === '/api/user/userInfo') {
        const id = Number(url.searchParams.get('userId'));
        data = { id, displayName: id === 30 ? 'FooFish' : 'Maycry', isFollowingHim: following.get(id) ?? false, isFollowingMe: true };
      } else if (/\/user\/(follow|unfollow)$/.test(path)) {
        const id = Number(url.searchParams.get('userId'));
        follows.push(id); following.set(id, path.endsWith('/follow')); data = null;
      }
      return route.fulfill({ status: 200, json: { code: 0, data } });
    });
    const tapTab = async name => {
      const tab = p.getByRole('tab', { name, exact: true });
      await tab.tap();
      await p.getByRole('tabpanel', { name, exact: true }).waitFor();
    };
    try {
      await p.goto(base + '/?demo=0&view=mobile#/notifications');
      await p.getByRole('link', { name: 'V2309A 不是本人登录时，可以让它下线', exact: true }).waitFor();
      await p.getByRole('button', { name: '已互关，取消关注FooFish', exact: true }).waitFor();
      await p.evaluate(() => document.fonts.ready);
      assert(await p.getByRole('navigation', { name: '主导航', exact: true }).count() === 0, 'Bottom navigation covers inbox');
      assert(await p.getByRole('tab').count() === 5, 'Expected one row of five categories');
      const boxes = [];
      for (const name of ['全部', '评论', '赞和收藏', '关注', '系统']) {
        const box = await p.getByRole('tab', { name, exact: true }).boundingBox();
        assert(box && box.height >= 44 && box.width >= 44, 'Tab touch target too small: ' + name);
        boxes.push(box);
      }
      assert(boxes.every(box => Math.abs(box.y - boxes[0].y) < 1 && box.x >= 0 && box.x + box.width <= width), 'Categories wrap or clip');
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
      const readAll = p.getByRole('button', { name: '全部已读', exact: true });
      await readAll.tap();
      await p.getByText('标记失败，请重试', { exact: true }).waitFor();
      assert(await p.getByRole('img', { name: '未读', exact: true }).count() === 3, 'Failed read erased unread indicators');
      await p.getByRole('button', { name: '关闭提示', exact: true }).tap();
      await p.getByText('标记失败，请重试', { exact: true }).waitFor({ state: 'hidden' });
      failAll = false;
      await readAll.tap();
      await p.waitForFunction(() => document.querySelectorAll('.mobile-inbox-unread-dot').length === 0);
      await p.getByText('全部通知已标为已读', { exact: true }).waitFor({ state: 'hidden' });
      assert(await readAll.isDisabled() && allCalls === 2, 'Read-all did not settle');
      await p.screenshot({ path: 'output/playwright/mobile-notifications-' + width + '.png', fullPage: true });
      await p.getByRole('button', { name: '已互关，取消关注FooFish', exact: true }).tap();
      await p.getByRole('button', { name: '回关FooFish', exact: true }).waitFor();
      assert(follows.length === 1 && following.get(30) === false && reads.length === 0, 'Follow also opened or read notification');
      await p.getByRole('button', { name: '回关FooFish', exact: true }).tap();
      await p.getByRole('button', { name: '已互关，取消关注FooFish', exact: true }).waitFor();
      await tapTab('评论');
      await p.getByRole('link', { name: '查看Apple 审核的主页', exact: true }).waitFor();
      const content = p.locator('.mobile-inbox-action[href="#/foods/7"]');
      await content.tap();
      await p.waitForURL(url => url.hash === '#/foods/7');
      await p.goBack();
      assert(await p.getByRole('tab', { name: '评论', exact: true }).getAttribute('aria-selected') === 'true', 'Return lost category');
      await tapTab('赞和收藏');
      await p.getByText('这个分类还没有消息', { exact: true }).waitFor();
      await tapTab('关注');
      await p.getByRole('button', { name: '已互关，取消关注Maycry', exact: true }).waitFor();
      await p.getByRole('tab', { name: '关注', exact: true }).press('End');
      await p.getByRole('tabpanel', { name: '系统', exact: true }).waitFor();
      await p.getByRole('link', { name: '站点公告', exact: true }).tap();
      await p.getByRole('heading', { name: '站点公告', exact: true }).waitFor();
      await p.getByRole('link', { name: '返回', exact: true }).tap();
      await p.getByRole('tabpanel', { name: '系统', exact: true }).waitFor();
      await p.getByRole('link', { name: 'V2309A 不是本人登录时，可以让它下线', exact: true }).tap();
      await p.waitForURL(url => url.hash === '#/settings/devices');
      await p.goBack();
      await p.getByRole('tabpanel', { name: '系统', exact: true }).waitFor();
      failList = true;
      await p.reload();
      await p.getByRole('button', { name: '重新加载', exact: true }).waitFor();
      failList = false;
      await p.getByRole('button', { name: '重新加载', exact: true }).tap();
      await p.getByRole('link', { name: 'V2309A 不是本人登录时，可以让它下线', exact: true }).waitFor();
      assert(columns.includes('COMMENTS') && columns.includes('FOLLOWS') && columns.includes('SYSTEM'), 'Categories did not request the right filter');
      assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
      results.push({ width, layout: 'passed', readAllAndRetry: 'passed', follow: 'passed', filtersAndReturn: 'passed', deviceLink: 'passed', errors });
    } catch (error) {
      await p.screenshot({ path: 'output/playwright/mobile-notifications-failure-' + width + '.png', fullPage: true });
      throw error;
    } finally { await context.close(); }
  }
  return results;
}
