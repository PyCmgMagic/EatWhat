async (page) => {
  const checks = [], failures = [], errors = [], requests = [];
  const onError = e => errors.push(e.message);
  page.on('pageerror', onError);
  await page.route(u => u.pathname.startsWith('/api/'), r => { requests.push(r.request().url()); return r.abort(); });
  const settle = async () => {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished));
    });
  };
  const inspect = async (mode, path, width, height) => {
    const desktop = mode === 'desktop' || (!mode && width >= 640);
    await page.setViewportSize({ width, height });
    await page.goto(`http://127.0.0.1:5173/?demo=1${mode ? '&view=' + mode : ''}#${path}`);
    await page.locator('.pc-app, .mobile-viewport, .ew-mobile-feature, .mobile-page-native').first().waitFor();
    if (path === '/search' || path === '/favorites') await page.locator('.ew-food-card').first().waitFor();
    if (path === '/publish' && desktop) await page.locator('.pc-composer-shops').waitFor();
    if (path === '/foods/1') await page.locator('.pc-dish-layout').waitFor();
    if (path === '/me/tags') await page.locator('.pc-tag-card').first().waitFor();
    await settle();
    const result = await page.evaluate(() => {
      const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
      const header = [...document.querySelectorAll('.pc-brand,.pc-header nav,.pc-header-actions')].map(rect);
      const overlap = header.some((a, i) => header.slice(i + 1).some(b => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2));
      const forms = [...document.querySelectorAll('.pc-composer-editor,.pc-profile-form,.ew-catalog-filters,.pc-secondary-section')].filter(e => e.getBoundingClientRect().width > 0).map(e => ({ cls: e.className, w: e.clientWidth, scroll: e.scrollWidth }));
      return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, desktop: !!document.querySelector('.pc-app'), zoom: document.querySelector('.pc-app') ? getComputedStyle(document.querySelector('.pc-app')).zoom : null, headerOverlap: overlap, forms, canvas: document.querySelector('.mobile-viewport') ? rect(document.querySelector('.mobile-viewport')) : null };
    });
    const entry = { mode: mode || 'auto', path, width, height, ...result };
    checks.push(entry);
    if (result.scroll > width + 1) failures.push({ ...entry, issue: '横向溢出' });
    if (result.headerOverlap) failures.push({ ...entry, issue: '页头重叠' });
    if (result.forms.some(f => f.scroll > f.w + 2)) failures.push({ ...entry, issue: '表单内部溢出' });
    if (result.desktop && result.zoom !== '1') failures.push({ ...entry, issue: 'PC 页面被整体缩放' });
    if (!mode && result.desktop !== desktop) failures.push({ ...entry, issue: '自动断点错误' });
    if (!mode && result.canvas && width <= 520 && Math.abs(result.canvas.w - width) > 1) failures.push({ ...entry, issue: '手机未占满宽度' });
  };
  try {
    for (const width of [320, 390, 430, 600, 767, 768, 820, 1024, 1280, 1440, 1920]) {
      for (const path of ['/', '/me', '/me/edit', '/publish', '/foods/1', '/nearby', '/search', '/favorites', '/me/tags', '/history', '/settings/privacy', '/restaurants/new', '/auth/password']) {
        await inspect('desktop', path, width, 900);
      }
    }
    for (const width of [320, 390, 430, 639, 640, 768, 820, 1023, 1024, 1440]) {
      for (const path of ['/', '/me', '/search', '/publish']) await inspect('', path, width, 844);
    }
    for (const [width, height] of [[320, 568], [390, 450], [667, 375], [844, 390], [1024, 600]]) {
      await inspect('', '/me?people=fans', width, height);
      const dialog = page.locator('.profile-people-dialog');
      await dialog.waitFor({state:'visible'}); await settle();
      const geometry = await dialog.evaluate(e => { const d=e.getBoundingClientRect(), close=e.querySelector('.profile-people-close').getBoundingClientRect(), foot=e.querySelector('footer').getBoundingClientRect(), sc=e.querySelector('.profile-people-scroll'); return { x:d.x, y:d.y, w:d.width, h:d.height, right:d.right, bottom:d.bottom, closeY:close.y, footerBottom:foot.bottom, scrollHeight:sc.clientHeight, overflow:e.scrollWidth > e.clientWidth }; });
      checks.push({ modal: true, width, height, geometry });
      if (geometry.x < -1 || geometry.y < -1 || geometry.right > width+1 || geometry.bottom > height+1 || geometry.footerBottom > height+1 || geometry.scrollHeight < 60 || geometry.overflow) failures.push({ width, height, geometry, issue:'弹层操作或内容区不可达' });
    }
    for (const [path, width, height, name, mode] of [
      ['/me',820,900,'tablet-profile',''],['/publish',820,1000,'tablet-publish',''],['/',820,900,'tablet-home',''],['/me/edit',1024,900,'laptop-profile-edit',''],['/settings/privacy',768,1000,'tablet-settings',''],['/',430,932,'phone-home',''],['/me?people=fans',667,375,'landscape-people',''],['/publish',390,844,'narrow-desktop-publish','desktop']
    ]) {
      await inspect(mode,path,width,height); await page.screenshot({path:`output/playwright/responsive-${name}.png`,fullPage:false});
    }
    const result = { checks:checks.length, failures, errors, networkRequests: requests.length, matrix:checks };
    await page.evaluate(result => sessionStorage.setItem('eatwhat-responsive-validation', JSON.stringify(result)), result);
    return { checks:result.checks, failures, errors, networkRequests:result.networkRequests };
  } finally {
    await page.unrouteAll(); page.off('pageerror', onError); await page.setViewportSize({width:1440,height:900}); await page.goto('http://127.0.0.1:5173/?demo=1&view=desktop#/me');
  }
}
