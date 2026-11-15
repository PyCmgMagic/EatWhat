async(page) => {
  const context = await page.context().browser().newContext();
  const p = await context.newPage(), checks = [], issues = [], errors = [], remote = [];
  p.on('pageerror', e => errors.push(e.message));
  await context.route(u => u.pathname.startsWith('/api/'), r => { remote.push(r.request().url()); return r.abort(); });
  await context.addInitScript(() => { window.__loadingDelay = 1000; window.__loadingPaths = {}; window.__loadingFailures = location.search.includes('failCold=1') ? ['/foods/detail/1'] : []; window.__loadingCalls = []; });
  // Delay the existing Mock transport, so all real query/rendering logic runs.
  await context.route('**/src/demo/transport.ts*', async r => {
    const response = await r.fetch();
    const original = await response.text();
    const body = original.replace('setTimeout(resolve, 150)', 'setTimeout(resolve, window.__loadingPaths[path] ?? window.__loadingDelay)');
    if (body === original) throw new Error('Mock delay injection did not match');
    const instrumented = body.replace('if (options.signal?.aborted)', 'if(window.__loadingFailures.includes(path)) throw new Error("模拟网络失败"); window.__loadingCalls.push(path); if (options.signal?.aborted)');
    if (instrumented === body) throw new Error('Mock failure injection did not match');
    await r.fulfill({ response, body: instrumented });
  });
  await context.route('**/src/app/context.tsx*', async r => {
    const response = await r.fetch(), original = await response.text();
    const body = original.replace('function useMe(', 'window.__loadingRefetch = key => queryClient.invalidateQueries({queryKey:key}); window.__loadingQuery = key => queryClient.getQueryState(key); function useMe(');
    if (body === original) throw new Error('Query instrumentation did not match');
    await r.fulfill({response,body});
  });
  const base = 'http://127.0.0.1:5173/?demo=1#';
  let navigation = 0;
  const visit = (path,fail=false) => p.goto(base.replace('#', '&loadingCase='+ ++navigation+(fail?'&failCold=1':'')+'#') + path);
  const settle = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  try {
    for (const width of [390, 820, 1440]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 1024 });
      for (const path of ['/', '/foods/1', '/restaurants/1', '/me', '/nearby', '/search', '/history', '/me/tags', '/settings/privacy']) {
        await visit(path);
        const skeleton = p.locator('.ew-page-skeleton,.ew-mobile-skeleton,.ew-content-skeleton').first();
        await skeleton.waitFor({ state: 'visible' });
        await settle();
        const initial = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, text: document.body.innerText }));
        if (initial.scroll > width + 1 || initial.text.includes('这里还没有内容') || initial.text.includes('先完成学生认证') || initial.text.includes('还没有自己的标签')) issues.push({width,path,initial});
        const nav = p.locator(width >= 640 ? '.pc-header' : '.design-navigation').first();
        const before = await nav.count() ? await nav.boundingBox() : null;
        const stableSelector = width >= 640 ? path === '/' ? '.pc-hero' : path === '/foods/1' ? '.pc-dish-layout' : path === '/restaurants/1' ? '.pc-restaurant-hero' : null : null;
        const frameBefore = stableSelector ? await p.locator(stableSelector).boundingBox() : null;
        if (path === '/' || path === '/foods/1' || path === '/restaurants/1') await p.screenshot({path:`output/playwright/loading-${width}-${path.replace(/\W+/g,'-')}.png`,fullPage:false});
        await p.waitForFunction(() => ![...document.querySelectorAll('.ew-page-skeleton,.ew-mobile-skeleton,.ew-content-skeleton')].some(e=>e.checkVisibility()));
        await settle();
        const after = await nav.count() ? await nav.boundingBox() : null;
        if (before && after && Math.abs(before.y-after.y)>1) issues.push({width,path,headerJump:{before,after}});
        const frameAfter = stableSelector ? await p.locator(stableSelector).boundingBox() : null;
        if (frameBefore && frameAfter && Math.abs(frameBefore.y-frameAfter.y)>1) issues.push({width,path,frameJump:{frameBefore,frameAfter}});
        if (await p.evaluate(() => document.documentElement.scrollWidth) > width+1) issues.push({width,path,overflowAfter:true});
        checks.push({width,path,skeleton:true,frameBefore,frameAfter});
      }
    }
    // A slow secondary request must not impersonate an empty address or menu.
    for (const width of [390, 1440]) {
      await p.setViewportSize({width,height:900});
      await visit('/foods/1');
      await p.evaluate(() => {window.__loadingDelay=100; window.__loadingPaths['/restaurant/detail/1']=2500;});
      await p.locator('.pc-dish-shop,.mobile-contributor').first().waitFor();
      await settle();
      if ((await p.locator('body').innerText()).includes('地址待补充')) issues.push({width,secondaryAddressShownAsEmpty:true});
      await p.waitForFunction(() => !document.querySelector('.pc-dish-shop .ew-skeleton, .design-screen .ew-skeleton'));
      checks.push({width,secondaryAddress:true});
    }
    await p.setViewportSize({width:1440,height:900});await visit('/nearby');
    await p.locator('.pc-shop-row').first().waitFor();
    await p.getByRole('textbox',{name:'附近搜店名',exact:true}).fill('袁');
    await settle();
    if (!await p.locator('.pc-shop-row').count() || await p.locator('.ew-content-skeleton').count()) issues.push({nearbyLostPreviousData:true});
    await p.locator('.pc-nearby-list-scroll[aria-busy=false]').waitFor();
    checks.push({nearbyBackgroundUpdateRetainsData:true});
    await visit('/foods/1');await p.locator('.pc-dish-info h1').waitFor();
    await p.waitForFunction(() => window.__loadingQuery(['foods','detail',1])?.fetchStatus==='idle');
    const title = await p.locator('.pc-dish-info h1').innerText();
    await p.evaluate(() => {window.__loadingFailures=['/foods/detail/1'];void window.__loadingRefetch(['foods','detail',1]);});
    await settle();
    if (!await p.locator('.pc-dish-info h1').count() || await p.locator('.ew-page-skeleton').count()) issues.push({detailBlankDuringRefresh:true});
    await p.waitForFunction(() => window.__loadingQuery(['foods','detail',1])?.status==='error');
    if (await p.locator('.pc-dish-info h1').innerText()!==title) issues.push({detailLostAfterRefreshError:true});
    checks.push({detailRetainedDuringRefreshAndFailure:true});
    await visit('/foods/1',true);await p.locator('.ew-page-skeleton').waitFor();
    const retry=p.getByRole('button',{name:'再试一次',exact:true});await retry.waitFor();
    if(await p.locator('.ew-page-skeleton').count() || (await p.locator('body').innerText()).includes('这里还没有内容'))issues.push({coldFailureStateIncorrect:true});
    await p.evaluate(()=>window.__loadingFailures=[]);await retry.click();await p.locator('.pc-dish-info h1').waitFor();checks.push({coldFailureIsNotEmptyAndRetryRecovers:true});
    const detailCalls=await p.evaluate(()=>window.__loadingCalls.filter(x=>x==='/foods/detail/1').length);
    await p.locator('.pc-breadcrumb a').first().click();await p.locator('.pc-food-card').first().waitFor();
    await p.locator('.pc-food-card[href="#/foods/1"]').click();await p.locator('.pc-dish-info h1').waitFor();await settle();
    if(await p.locator('.ew-page-skeleton').count() || await p.evaluate(()=>window.__loadingCalls.filter(x=>x==='/foods/detail/1').length)!==detailCalls)issues.push({warmReturnCacheMiss:true});
    checks.push({warmReturnUsesFreshCacheWithoutSkeletonOrNewRequest:true});
    const result={checks,issues,errors,realBackendRequests:remote.length};
    await page.evaluate(r=>sessionStorage.setItem('eatwhat-loading-validation',JSON.stringify(r)),result);
    return result;
  } catch(error) {await p.screenshot({path:'output/playwright/loading-failure.png'});throw new Error(String(error)+' '+p.url()+' '+JSON.stringify(await p.locator('.ew-page-skeleton,.ew-mobile-skeleton,.ew-content-skeleton').evaluateAll(es=>es.map(e=>({class:e.className,visible:e.checkVisibility(),parent:e.parentElement.className,rect:e.getBoundingClientRect().toJSON()})))));} finally {await context.close();}
}
