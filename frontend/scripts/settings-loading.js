async function verifySettingsLoading(browserPage) {
  const context = await browserPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), checks = [], errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  await context.addInitScript(() => localStorage.setItem('eatwhat-session', JSON.stringify({ tokenName: 'x-session', tokenValue: 'isolated-loading-test' })));
  let userGate, releaseUser, moduleGate, releaseModule, moduleStarted, onModuleStarted, modulePath;
  const user = { id: 10, displayName: 'PyCmg', verified: true, banned: false, role: 'user', phone: '18712344033', hasPassword: true, hasUsername: true, userName: 'pycmg' };
  await context.route(u => u.origin !== 'http://127.0.0.1:5173', r => r.abort());
  await context.route(u => u.pathname.startsWith('/api/'), async r => {
    const path = new URL(r.request().url()).pathname;
    let data = [];
    if (path === '/api/user/info') { await userGate; data = user; }
    else if (path === '/api/remote-config') data = { configVersion: 1, flags: {}, params: {}, maintenance: {mode:'NONE'}, announcements: [], versions: {} };
    else if (path === '/api/campus/list') data = [{id:1,name:'软件园',open:true,isDefault:true}];
    else if (path === '/api/notification/unread/count') data = 0;
    await r.fulfill({status:200,json:{code:0,data}});
  });
  await context.route(u => u.pathname === '/src/features/SettingsHome.tsx' || u.pathname === '/src/desktop/DesktopProfile.tsx', async r => {
    if (new URL(r.request().url()).pathname === modulePath) {
      onModuleStarted();
      await moduleGate;
    }
    await r.continue();
  });
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const boxes = async path => page.evaluate(path => {
    const selectors = path === '/settings'
      ? ['.settings-home-heading','.settings-home-profile','.settings-home-avatar','.settings-home-identity h2','.settings-home-identity > div','.settings-home-status','.settings-home-groups','.settings-home-group','.settings-home-group > header','.settings-home-group-items','.settings-home-support']
      : ['.pc-profile-editor .pc-secondary-head','.pc-profile-form','.pc-profile-avatar-row','.pc-profile-avatar-picker','.pc-profile-form .pc-secondary-section','.pc-profile-fields','.pc-profile-savebar'];
    return Object.fromEntries(selectors.map(selector => [selector, [...document.querySelectorAll(selector)].filter(el => el.checkVisibility()).map(el => {
      const {x,y,width,height} = el.getBoundingClientRect(); return {x,y,width,height};
    })]));
  },path);
  const compare = (before, after, label) => {
    const differences = [];
    for (const [selector, items] of Object.entries(before)) {
      assert(items.length === after[selector].length, 'Different element count '+label+' '+selector+' '+items.length+' -> '+after[selector].length);
      items.forEach((box,i) => { for (const prop of ['x','y','width','height']) {
        const diff = Math.abs(box[prop] - after[selector][i][prop]);
        if (diff > 2) differences.push({selector, i, prop, before:box[prop], after:after[selector][i][prop], diff});
      }});
    }
    assert(!differences.length, label+' '+JSON.stringify(differences));
  };
  try {
    for (const width of [600,1024,1440,1920]) {
      await page.setViewportSize({width,height:1000});
      for (const path of ['/settings','/me/edit']) {
        userGate = new Promise(r => { releaseUser = r; });
        moduleGate = new Promise(r => { releaseModule = r; });
        moduleStarted = new Promise(r => { onModuleStarted = r; });
        modulePath = path === '/settings' ? '/src/features/SettingsHome.tsx' : '/src/desktop/DesktopProfile.tsx';
        await page.goto('http://127.0.0.1:5173/?demo=0&loadingCase='+width+'-'+checks.length+'#'+path,{waitUntil:'domcontentloaded'});
        const loading = page.locator(path === '/settings' ? '.settings-home-loading:visible' : '.pc-profile-loading:visible');
        await loading.waitFor();
        await page.evaluate(() => document.fonts.ready);
        await settle();
        assert(await page.locator('.pc-profile-rail').count() === 1,'Duplicate sidebar');
        assert(await page.locator('.ew-page-skeleton.profile').count() === 0,'Old profile skeleton still mounted');
        assert(await loading.getAttribute('aria-busy') === 'true','Missing loading announcement');
        const before = await boxes(path);
        if (width === 1440) await page.screenshot({path:'../output/playwright/settings-loading-'+(path === '/settings' ? 'home' : 'editor')+'.png',fullPage:true});
        releaseUser();
        await moduleStarted;
        await settle();
        compare(before,await boxes(path),'Data/module loading changed layout '+width+' '+path);
        releaseModule();
        await loading.waitFor({state:'detached'});
        await (path === '/settings' ? page.locator('.settings-home-edit') : page.locator('#nick')).waitFor();
        await settle();
        const after = await boxes(path);
        compare(before,after,'Skeleton/content changed layout '+width+' '+path);
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1),'Horizontal overflow');
        checks.push({width,path,matchedGeometry:true,singleSidebar:true,dataAndModuleLoading:true});
      }
    }
    assert(!errors.length,errors.join('\n'));
    return {checks,pageErrors:errors,realBackendRequests:0};
  } catch (error) {
    await page.screenshot({path:'../output/playwright/settings-loading-failure.png',fullPage:true});
    throw new Error(JSON.stringify({error:String(error),checks,url:page.url(),text:(await page.locator('body').innerText()).slice(0,800)}));
  } finally { releaseUser?.(); releaseModule?.(); await context.close(); }
}
