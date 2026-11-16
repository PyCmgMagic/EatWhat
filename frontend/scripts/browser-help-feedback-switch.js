// Run with Playwright CLI's run-code --filename against a local Vite tab.
// Every API response is isolated; the script never submits feedback.
async (page) => {
  const base = new URL(page.url()).origin;
  const results = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  for (const width of [320, 390, 520, 1440]) {
    const mobile = width < 640;
    const context = await page.context().browser().newContext({
      viewport: { width, height: mobile ? 844 : 1000 },
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: width === 520 ? 'reduce' : 'no-preference',
    });
    const p = await context.newPage();
    p.setDefaultTimeout(8000);
    const errors = [], feedbackWrites = [];
    p.on('pageerror', error => errors.push(error.message));
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const item = {
      id: 42, kind: 'FEEDBACK', text: '切换回归测试记录', status: 'PENDING',
      createdAt: '2026-11-15T10:00:00Z', screenshots: [],
    };
    await context.addInitScript(() => {
      localStorage.setItem('eatwhat-session', JSON.stringify({
        tokenName: 'x-session', tokenValue: 'isolated-help-feedback',
      }));
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) return route.abort();
      if (url.pathname === '/src/features/v4/Community.tsx') {
        await held;
        return route.continue();
      }
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname.startsWith('/api/feedback') && request.method() !== 'GET') {
        feedbackWrites.push(url.pathname);
      }
      let data = { items: [], totalItems: 0, totalPages: 0, hasNext: false };
      if (url.pathname === '/api/user/info') {
        data = { id: 10, displayName: '切换测试', verified: true, banned: false, role: 'user' };
      } else if (url.pathname === '/api/campus/list') {
        data = [{ id: 1, name: '软件园', open: true, isDefault: true }];
      } else if (url.pathname === '/api/remote-config') {
        data = { configVersion: 1, flags: {}, params: {}, maintenance: { mode: 'NONE' }, announcements: [], versions: {} };
      } else if (url.pathname === '/api/user/activity') {
        data = { firstUseToday: false, experienceAdded: 0 };
      } else if (url.pathname === '/api/notification/cards/unread/count') {
        data = { cards: 0, members: 0 };
      } else if (url.pathname === '/api/feedback/mine') {
        data = { items: [item], totalItems: 1, totalPages: 1, hasNext: false };
      } else if (url.pathname === '/api/feedback/mine/42') {
        data = item;
      }
      return route.fulfill({ status: 200, json: { code: 0, data } });
    });
    const nav = p.getByRole('navigation', { name: '帮助与反馈', exact: true });
    const selected = async path => {
      await p.waitForURL(url => url.hash === '#' + path, { timeout: 1000 });
      await p.waitForFunction(path =>
        document.querySelector('.profile-section-nav a[aria-current="page"]')?.getAttribute('href') === '#' + path,
      path, { timeout: 400 });
      assert(await nav.count() === 1, 'Duplicate navigation at ' + width);
      assert(await nav.locator('a[aria-current="page"]').count() === 1, 'Ambiguous selection');
    };
    const tap = async path => {
      const link = nav.locator('a[href="#' + path + '"]');
      await link.scrollIntoViewIfNeeded();
      const box = await link.boundingBox();
      assert(box && box.height >= 44, 'Missing or undersized tab at ' + width);
      assert(await link.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }), 'Tab is covered at ' + width);
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      if (mobile) await p.touchscreen.tap(x, y);
      else await p.mouse.click(x, y);
      await selected(path);
    };
    try {
      await p.goto(base + '/?demo=0&view=' + (mobile ? 'mobile' : 'desktop') + '#/help');
      await nav.waitFor();
      await p.evaluate(() => document.fonts.ready);
      await nav.evaluate(el => { el.dataset.stabilityProbe = 'kept'; });
      // A cold module stays blocked: selection must still respond to one tap.
      const moduleRequest = p.waitForRequest(request => new URL(request.url()).pathname === '/src/features/v4/Community.tsx');
      await tap('/feedback');
      await moduleRequest;
      await p.getByRole('status', { name: '正在加载内容', exact: true }).waitFor();
      await tap('/feedback/mine');
      await tap('/help');
      await p.getByRole('searchbox', { name: '搜索使用帮助', exact: true }).waitFor();
      assert(await nav.getAttribute('data-stability-probe') === 'kept', 'Navigation remounted while loading');
      release();
      await tap('/feedback');
      const textarea = p.getByRole('textbox', { name: '反馈内容', exact: true });
      await textarea.waitFor();
      const draft = '切换标签后保留的反馈草稿 ' + width;
      await textarea.fill(draft);
      await p.locator('input[type="file"]').setInputFiles({
        name: 'feedback-draft.png', mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOu4AAAAASUVORK5CYII=', 'base64'),
      });
      for (let i = 0; i < 12; i++) {
        const path = ['/feedback/mine', '/help', '/feedback'][i % 3];
        await tap(path);
        if (path === '/feedback/mine') await p.getByText(item.text, { exact: true }).waitFor();
        if (path === '/help') await p.getByRole('searchbox', { name: '搜索使用帮助', exact: true }).waitFor();
        if (path === '/feedback') await textarea.waitFor();
      }
      assert(await textarea.inputValue() === draft, 'Draft text lost at ' + width);
      await p.locator('.v4-upload-files').getByText('feedback-draft.png', { exact: true }).waitFor();
      assert(await nav.getAttribute('data-stability-probe') === 'kept', 'Navigation remounted on a tab change');
      assert(await p.getByRole('heading', { name: '帮助与反馈', exact: true }).count() === 1, 'Repeated page heading');
      await p.goBack();
      await selected('/help');
      await p.goForward();
      await selected('/feedback');
      assert(await textarea.inputValue() === draft, 'History navigation lost the draft');
      await nav.scrollIntoViewIfNeeded();
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow at ' + width);
      if (width === 390 || width === 1440) {
        await p.screenshot({ path: 'output/playwright/help-feedback-' + width + '.png', fullPage: true });
      }
      await tap('/feedback/mine');
      await p.getByText(item.text, { exact: true }).click();
      await p.getByRole('heading', { name: '反馈处理进度', exact: true }).waitFor();
      await p.goBack();
      await selected('/feedback/mine');
      await p.getByText(item.text, { exact: true }).waitFor();
      assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
      assert(feedbackWrites.length === 0, 'Switching tabs submitted feedback');
      results.push({ width, coldLoad: 'passed', singleTapSwitches: 16, draftAndAttachment: 'kept', history: 'passed', detailReturn: 'passed', errors });
    } catch (error) {
      await p.screenshot({ path: 'output/playwright/help-feedback-failure-' + width + '.png', fullPage: true });
      throw error;
    } finally {
      release();
      await context.close();
    }
  }
  return results;
}
