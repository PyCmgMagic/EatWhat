// Run with Playwright CLI run-code --filename against a local Vite page.
// All API requests are mocked; feedback is never sent to the real service.
async (page) => {
  const base = new URL(page.url()).origin;
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  for (const width of [320, 390, 520]) {
    const context = await page.context().browser().newContext({
      viewport: { width, height: 844 }, isMobile: true, hasTouch: true,
      reducedMotion: width === 520 ? 'reduce' : 'no-preference',
    });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    const errors = [], writes = [];
    let items = [], failSubmit = true, failList = false;
    p.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => {
      localStorage.setItem('eatwhat-session', JSON.stringify({
        tokenName: 'x-session', tokenValue: 'isolated-mobile-feedback',
      }));
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      let data = { items: [], totalItems: 0, totalPages: 0, hasNext: false };
      if (url.pathname === '/api/user/info') {
        data = { id: 10, displayName: '手机反馈测试', verified: true, banned: false, role: 'user' };
      } else if (url.pathname === '/api/campus/list') {
        data = [{ id: 1, name: '软件园', open: true, isDefault: true }];
      } else if (url.pathname === '/api/remote-config') {
        data = { configVersion: 1, flags: {}, params: {}, maintenance: { mode: 'NONE' }, announcements: [], versions: {} };
      } else if (url.pathname === '/api/user/activity') {
        data = { firstUseToday: false, experienceAdded: 0 };
      } else if (url.pathname === '/api/notification/cards/unread/count') {
        data = { cards: 0, members: 0 };
      } else if (url.pathname === '/api/feedback/mine') {
        if (failList) return route.fulfill({ status: 400, json: { code: 400, msg: '记录暂时无法加载' } });
        data = { items, totalItems: items.length, totalPages: items.length ? 1 : 0, hasNext: false };
      } else if (url.pathname === '/api/feedback/messages') {
        const body = request.postDataJSON();
        writes.push(body);
        if (failSubmit) return route.fulfill({ status: 400, json: { code: 400, msg: '提交失败，请重试' } });
        items = [{ id: 42, kind: 'FEEDBACK', status: 'PENDING', createdAt: '2026-11-22T04:00:00Z', screenshots: [], ...body }];
        data = { id: 42 };
      } else if (url.pathname === '/api/feedback/mine/42') {
        data = items[0];
      }
      return route.fulfill({ status: 200, json: { code: 0, data } });
    });
    const about = async () => {
      await p.getByRole('link', { name: '返回', exact: true }).click();
      await p.getByRole('heading', { name: '关于', exact: true }).waitFor();
    };
    const openForm = async () => {
      await p.getByRole('link', { name: '反馈 问题反馈与建议', exact: true }).click();
      await p.getByRole('textbox', { name: '反馈内容', exact: true }).waitFor();
    };
    const openRecords = async () => {
      await p.getByRole('link', { name: '我的反馈 提交记录与处理结果', exact: true }).click();
      await p.getByRole('heading', { name: '我的反馈', exact: true }).waitFor();
    };
    const fits = async () => {
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow at ' + width);
      assert(await p.getByRole('navigation', { name: '主导航', exact: true }).count() === 0, 'Main navigation covers standalone page');
      assert(await p.getByRole('navigation', { name: '帮助与反馈', exact: true }).count() === 0, 'Desktop tabs on phone');
    };
    try {
      await p.goto(base + '/?demo=0&view=mobile#/settings/about');
      await openForm();
      await p.evaluate(() => document.fonts.ready);
      await fits();
      const text = p.getByRole('textbox', { name: '反馈内容', exact: true });
      const submit = p.getByRole('button', { name: '提交', exact: true });
      assert(await submit.isDisabled(), 'Empty form can submit');
      assert(await p.getByRole('combobox').count() === 0, 'Category is still a dropdown');
      assert(await text.getAttribute('maxlength') === '500', 'Missing text limit');
      for (const name of ['遇到问题', '提个建议', '其他反馈']) {
        const box = await p.getByRole('radio', { name, exact: true }).boundingBox();
        assert(box && box.height >= 44 && box.width >= 44, 'Category touch target too small');
      }
      const add = p.getByRole('button', { name: '添加截图', exact: true });
      const box = await add.boundingBox();
      assert(box && box.width <= 90 && Math.abs(box.width - box.height) < 1, 'Screenshot add is not a compact square');
      if (width === 390) await p.screenshot({ path: 'output/playwright/mobile-feedback-form-390.png', fullPage: true });
      const draft = '手机端反馈测试：返回后保留内容 ' + width;
      await text.fill(draft);
      assert(await submit.isDisabled(), 'Category is required');
      await p.getByRole('radio', { name: '遇到问题', exact: true }).check();
      assert(await submit.isEnabled(), 'Valid form is disabled');
      await text.fill('  ');
      assert(await submit.isDisabled(), 'Whitespace can submit');
      await text.fill(draft);
      const screenshot = await p.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 480; canvas.height = 800;
        return canvas.toDataURL('image/png').split(',')[1];
      });
      const attachment = { name: 'feedback.png', mimeType: 'image/png', buffer: Buffer.from(screenshot, 'base64') };
      await p.locator('input[type="file"]').setInputFiles(attachment);
      const thumbnail = p.getByRole('button', { name: '预览第 1 张截图', exact: true });
      await thumbnail.waitFor();
      await about();
      await openRecords();
      await p.getByRole('heading', { name: '还没有提交过反馈', exact: true }).waitFor();
      await fits();
      if (width === 390) await p.screenshot({ path: 'output/playwright/mobile-feedback-empty-390.png', fullPage: true });
      await about();
      await openForm();
      assert(await text.inputValue() === draft, 'Return lost draft');
      assert(await p.getByRole('radio', { name: '遇到问题', exact: true }).isChecked(), 'Return lost category');
      await thumbnail.waitFor();
      await p.locator('input[type="file"]').setInputFiles([
        { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') },
        { ...attachment, name: 'second.png' },
      ]);
      await p.getByText(/无法读取截图.*broken\.png/).waitFor();
      await p.getByRole('button', { name: '预览第 2 张截图', exact: true }).waitFor();
      await p.locator('input[type="file"]').setInputFiles({ ...attachment, name: 'third.png' });
      await p.getByRole('button', { name: '预览第 3 张截图', exact: true }).waitFor();
      assert(await add.count() === 0, 'More than three screenshots allowed');
      await thumbnail.click();
      const preview = p.getByRole('dialog', { name: '截图预览 · 1 / 3', exact: true });
      await preview.waitFor();
      assert(await preview.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Screenshot preview overflows');
      await p.keyboard.press('Escape');
      await preview.waitFor({ state: 'hidden' });
      for (let i = 0; i < 3; i++) await p.getByRole('button', { name: '移除第 1 张截图', exact: true }).click();
      await add.waitFor();
      assert(await add.evaluate(el => el === document.activeElement), 'Removal lost keyboard focus');
      if (width === 390) {
        await p.setViewportSize({ width, height: 420 });
        await text.focus();
        await submit.scrollIntoViewIfNeeded();
        assert(await submit.evaluate(el => {
          const b = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
        }), 'Submit covered in short viewport');
        await fits();
        await p.setViewportSize({ width, height: 844 });
      }
      await submit.click();
      await p.getByText('提交失败，请重试', { exact: true }).waitFor();
      assert(await text.inputValue() === draft, 'Failure lost text');
      assert(await submit.isEnabled(), 'Failure cannot retry');
      failSubmit = false;
      await submit.click();
      await p.getByRole('heading', { name: '反馈处理进度', exact: true }).waitFor();
      assert(writes.length === 2 && writes[1].category === 'PROBLEM' && writes[1].text === draft, 'Submission payload mismatch');
      await p.goBack();
      await text.waitFor();
      assert(await text.inputValue() === '', 'Success did not clear draft');
      assert(await submit.isDisabled(), 'Success did not reset form');
      await about();
      await openRecords();
      await p.getByText(draft, { exact: true }).waitFor();
      await fits();
      failList = true;
      await p.reload();
      await p.getByRole('heading', { name: '内容暂时未能加载', exact: true }).waitFor();
      assert(await p.getByRole('heading', { name: '还没有提交过反馈', exact: true }).count() === 0, 'Error shown as empty state');
      failList = false;
      await p.getByRole('button', { name: '重新加载', exact: true }).click();
      await p.getByText(draft, { exact: true }).waitFor();
      assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
      results.push({ width, form: 'passed', drafts: 'kept', screenshots: 'passed', submissionAndRetry: 'passed', recordsAndRetry: 'passed', errors });
    } catch (error) {
      await p.screenshot({ path: 'output/playwright/mobile-feedback-failure-' + width + '.png', fullPage: true });
      throw error;
    } finally {
      await context.close();
    }
  }
  return results;
}
