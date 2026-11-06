async(page) => {
  const browser=page.context().browser(), checks=[],issues=[],errors=[],remote=[];
  const context=await browser.newContext(); const p=await context.newPage();
  p.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>window.__perfCalls=[]);
  await context.route(u=>u.pathname.startsWith('/api/'),r=>{remote.push(r.request().url());return r.abort()});
  await context.route('**/src/demo/transport.ts*',async r=>{
    const response=await r.fetch(),original=await response.text();
    const body=original.replace('if (options.signal?.aborted)','window.__perfCalls.push({path,query:options.query}); if (options.signal?.aborted)');
    if(body===original)throw new Error('Mock instrumentation did not match');await r.fulfill({response,body});
  });
  const requests=[];p.on('request',r=>requests.push(decodeURIComponent(r.url())));
  const base='http://127.0.0.1:5173/?demo=1#';
  try{
    await p.setViewportSize({width:1440,height:1000});await p.goto(base+'/');await p.locator('.pc-food-card').first().waitFor();
    const desktopScreens=requests.filter(u=>u.includes('virtual:eatwhat-screens/'));
    if(desktopScreens.length||requests.some(u=>u.includes('/pages/Admin.tsx')))issues.push({desktopEagerPages:desktopScreens});
    checks.push('桌面首页不请求原型画板与管理后台代码');
    const images=await p.locator('.pc-food-card img').evaluateAll(es=>es.map(e=>({loading:e.loading,decoding:e.decoding})));
    if(images.some(e=>e.loading!=='lazy'||e.decoding!=='async')||await p.locator('.pc-current-plate img').getAttribute('fetchpriority')!=='high')issues.push({imagePriorities:images});
    checks.push('列表图延迟加载与异步解码，当前推荐图优先加载');
    await p.goto(base+'/nearby');await p.locator('.pc-shop-row').first().waitFor();
    await p.evaluate(()=>window.__perfCalls=[]);
    const search=p.getByRole('textbox',{name:'附近搜店名',exact:true});await search.pressSequentially('袁记云饺',{delay:30});
    await p.waitForFunction(()=>document.querySelector('.pc-nearby-list-scroll')?.getAttribute('aria-busy')==='false');
    const keywords=await p.evaluate(()=>window.__perfCalls.filter(c=>c.path.startsWith('/restaurant/')&&c.query?.keyword).map(c=>c.query.keyword));
    if(JSON.stringify(keywords)!==JSON.stringify(['袁记云饺']))issues.push({desktopKeywords:keywords});
    await search.fill('');await p.locator('.pc-shop-row').nth(1).waitFor();checks.push('桌面连续输入4个字只提交1次搜索，清空即时恢复缓存');
    await p.goto('about:blank');await p.setViewportSize({width:390,height:844});requests.length=0;await p.goto('http://127.0.0.1:5173/?demo=1&perf=mobile#/');
    await p.locator('.design-screen[data-screen="G2-Home"]').waitFor();await p.locator('.design-food-tile').first().waitFor();
    const mobileScreens=requests.filter(u=>u.includes('virtual:eatwhat-screens/'));
    if(mobileScreens.length!==1||!mobileScreens[0].includes('/G2-Home'))issues.push({mobileEagerPages:mobileScreens});
    checks.push('手机首页仅加载当前1张画板');
    await p.goto(base+'/publish');await p.getByRole('radio').first().waitFor();await p.evaluate(()=>window.__perfCalls=[]);
    await p.locator('.design-screen input').first().pressSequentially('袁记云饺',{delay:30});
    await p.waitForFunction(()=>window.__perfCalls.some(c=>c.query?.keyword==='袁记云饺'));
    const mobileKeywords=await p.evaluate(()=>window.__perfCalls.filter(c=>c.path.startsWith('/restaurant/')&&c.query?.keyword).map(c=>c.query.keyword));
    if(JSON.stringify(mobileKeywords)!==JSON.stringify(['袁记云饺']))issues.push({mobileKeywords});checks.push('手机选店连续输入4个字只提交1次搜索');
    await p.goto(base+'/design');const screens=await p.locator('.reference-index a').evaluateAll(es=>es.map(e=>e.getAttribute('href').split('/').pop()));
    for(const screen of screens){await p.goto(base+'/reference/'+screen);await p.locator(`.design-screen[data-screen="${screen}"]`).waitFor();if(await p.locator('.fatal-error').count())issues.push({screen,fatal:true});}
    checks.push(`${screens.length} 张原型画板按需模块全部可加载`);
  }finally{await context.close()}
  const production=await browser.newContext();const prod=await production.newPage();prod.on('pageerror',e=>errors.push(e.message));
  await production.route(u=>u.pathname.startsWith('/api/'),r=>{remote.push(r.request().url());return r.abort()});
  const prodRequests=[];prod.on('request',r=>prodRequests.push(r.url()));
  let metrics;
  try{
    await prod.setViewportSize({width:1440,height:1000});await prod.goto('http://127.0.0.1:5174/?demo=1#/');await prod.locator('.pc-food-card').first().waitFor();await prod.evaluate(()=>document.fonts.ready);
    if(prodRequests.some(u=>/\/assets\/(G[A-Z0-9-]|Admin-|DesktopPublish-|DesktopProfile-)/.test(u)))issues.push({productionEagerChunks:prodRequests.filter(u=>u.endsWith('.js'))});
    metrics=await prod.evaluate(()=>({navigation:performance.getEntriesByType('navigation').map(e=>({domContentLoaded:e.domContentLoadedEventEnd,load:e.loadEventEnd})),scripts:performance.getEntriesByType('resource').filter(e=>e.initiatorType==='script'||e.name.endsWith('.js')).map(e=>({name:e.name.split('/').pop(),bytes:e.decodedBodySize,duration:e.duration}))}));
    await prod.screenshot({path:'output/playwright/performance-production-home.png'});
    await prod.getByRole('link',{name:'发布一道菜',exact:true}).click();await prod.locator('.pc-composer').waitFor();if(!prodRequests.some(u=>u.includes('/assets/DesktopPublish-')))issues.push({publishChunkMissing:true});
    await prod.goto('http://127.0.0.1:5174/?demo=1&perf=mobile#/');await prod.setViewportSize({width:390,height:844});await prod.locator('.design-screen[data-screen="G2-Home"]').waitFor();await prod.locator('.design-food-tile').first().waitFor();await prod.screenshot({path:'output/playwright/performance-production-mobile.png'});
    checks.push('生产构建：首页按需请求、发布页分包、手机画板正常');
  }finally{await production.close()}
  const result={checks,issues,errors,realBackendRequests:remote.length,localProductionObservations:metrics};await page.evaluate(r=>sessionStorage.setItem('eatwhat-performance',JSON.stringify(r)),result);return result;
}
