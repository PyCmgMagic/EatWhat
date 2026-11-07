async (page) => {
  const base='http://127.0.0.1:5173',browser=page.context().browser(),engine=browser.browserType().name();
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await context.newPage(),checks=[],errors=[];
  p.setDefaultTimeout(10000);
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))errors.push(m.text())});
  let responseMode='content',releaseRecommendation,notifyRecommendation;
  const food={id:71,name:'招牌牛筋面',restaurantName:'汤见17码头',restaurantId:9,price:18.9,category:'staple',pictureUrl:['/prototype/assets/photos/sq_luosi.png']};
  await context.route(url=>url.origin!==base,route=>route.abort());
  await context.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const path=new URL(route.request().url()).pathname;
    let data={items:[],totalItems:0,hasNext:false};
    if(path==='/api/foods/recommend') {
      if(responseMode==='pending')await new Promise(resolve=>{releaseRecommendation=resolve;notifyRecommendation?.()});
      if(responseMode==='error')return route.fulfill({status:503,json:{code:503,msg:'推荐暂不可用'}});
      data=responseMode==='empty'?[]:[food];
    } else if(path==='/api/campus/list')data=[{id:1,name:'软件园',open:true,isDefault:true}];
    else if(path==='/api/remote-config')data={configVersion:1,flags:{},params:{},maintenance:{mode:'NONE'},announcements:[],versions:{}};
    return route.fulfill({status:200,json:{code:0,data}});
  });
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
  const nav=p.getByRole('navigation',{name:'主导航',exact:true});
  const measure=async()=>{
    await nav.waitFor();
    await p.evaluate(async()=>{await document.fonts.ready});
    return p.evaluate(()=>{
      const root=document.querySelector('.mobile-main-navigation');
      const rect=el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100)};
      const style=el=>{const s=getComputedStyle(el);return [s.fontSize,s.fontFamily,s.lineHeight,s.borderRadius]};
      const links=[...root.querySelectorAll('nav a')];
      return {rects:[root,root.querySelector('nav'),root.querySelector('.design-fab'),...links,...root.querySelectorAll('.design-icon')].map(rect),styles:links.map(style),outsideCanvas:!root.closest('.mobile-canvas'),count:document.querySelectorAll('.design-navigation').length,bottom:Math.round((innerHeight-root.getBoundingClientRect().bottom)*100)/100};
    });
  };
  const same=async(expected,note)=>{
    const actual=await measure();
    assert(JSON.stringify(actual)===JSON.stringify(expected),JSON.stringify({note,expected,actual}));
    assert(await p.evaluate(()=>window.__sharedNav===document.querySelector('.mobile-main-navigation')),'Navigation remounted: '+note);
  };
  const remember=()=>p.evaluate(()=>{window.__sharedNav=document.querySelector('.mobile-main-navigation')});
  const clickTab=async name=>{
    await nav.getByRole('link',{name,exact:true}).click();
    await p.waitForFunction(label=>document.querySelector('.mobile-main-navigation a[aria-current="page"]')?.textContent.trim()===label,name);
  };
  try {
    for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[520,900]]) {
      await p.setViewportSize({width,height});
      await p.goto(base+'/?demo=1#/');
      const expected=await measure();await remember();
      assert(expected.outsideCanvas&&expected.count===1&&expected.rects[0][3]===60&&expected.bottom===12,'Navigation not using the shared fixed shell');
      for(const name of ['发现','附近','我的','发现']) {
        await clickTab(name);await same(expected,`${width} ${name}`);
        if(name==='附近')await p.locator('.mobile-nearby-results .mobile-nearby-shop').last().waitFor();
        if(name==='我的')await p.locator('.profile-mobile-page h1,.design-screen[data-screen="G-Me"] h1').first().waitFor();
        await p.evaluate(()=>{window.scrollTo(0,document.documentElement.scrollHeight);const list=document.querySelector('.mobile-nearby-results');if(list)list.scrollTop=list.scrollHeight});
        await same(expected,`${width} ${name} scrolled`);
        if(name==='附近') {
          const last=p.locator('.mobile-nearby-shop').last();
          const row=await last.boundingBox(),bar=await p.locator('.mobile-main-navigation').boundingBox();
          assert(row&&bar&&row.y+row.height<=bar.y+1,'Last restaurant is covered by navigation');
        }
        if(width===360&&name!=='发现')await p.screenshot({path:`output/playwright/navigation-${engine}-${name==='附近'?'nearby':'me'}.png`});
        await p.evaluate(()=>window.scrollTo(0,0));
        if(width===360&&name==='发现')await p.screenshot({path:`output/playwright/navigation-${engine}-home.png`});
        checks.push(`${width} ${name}: same DOM, position, size and typography before/after scrolling`);
      }
    }
    await p.setViewportSize({width:390,height:500});
    await p.evaluate(()=>document.documentElement.style.setProperty('--mobile-nav-bottom','34px'));
    const compact=await measure();await remember();
    assert(compact.bottom===34&&compact.rects[0][3]===60,'Bottom safe-area changed nav size');
    for(const name of ['附近','我的','发现']) {await clickTab(name);await same(compact,'short viewport + safe area: '+name)}
    checks.push('Short viewport and bottom safe-area retain identical navigation');
    await p.evaluate(()=>document.documentElement.style.removeProperty('--mobile-nav-bottom'));

    await p.evaluate(()=>localStorage.setItem('eatwhat-campus','1'));
    responseMode='pending';
    const recommendationStarted=new Promise(resolve=>notifyRecommendation=resolve);
    await p.setViewportSize({width:390,height:844});
    await p.goto(base+'/?demo=0#/');
    const loading=await measure();await remember();
    assert(loading.count===1,'Loading state creates duplicate navigation');
    await p.locator('.ew-mobile-skeleton').waitFor();
    await Promise.race([recommendationStarted,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Recommendation request did not start')),10000))]);
    assert(releaseRecommendation,'Recommendation request did not start');
    responseMode='error';releaseRecommendation();
    await p.getByRole('heading',{name:'推荐暂时没端上来',exact:true}).waitFor();
    await same(loading,'API error');
    responseMode='empty';await p.getByRole('button',{name:'重新加载推荐',exact:true}).click();
    await p.getByRole('heading',{name:'暂时没有推荐',exact:true}).waitFor();
    await same(loading,'empty response');
    responseMode='content';await p.getByRole('button',{name:'刷新推荐',exact:true}).click();
    await p.locator('.mobile-home-copy h1').filter({hasText:food.name}).waitFor();
    await same(loading,'successful retry');
    await clickTab('我的');await same(loading,'guest profile');
    checks.push('Loading, error, empty, success and guest profile share one stable navigation');
    await clickTab('发现');
    await p.locator('.mobile-home-toolbar > a').click();
    await p.getByRole('dialog',{name:'地点和饭点',exact:true}).waitFor();
    assert(await p.locator('.mobile-main-navigation').getAttribute('inert')!==null,'Navigation remains interactive behind a panel');
    await p.keyboard.press('Escape');await p.getByRole('dialog',{name:'地点和饭点',exact:true}).waitFor({state:'hidden'});
    await same(loading,'place panel closed');
    checks.push('Panels block background navigation and restore it at the same position');
    await p.setViewportSize({width:1024,height:768});
    await p.goto(base+'/?demo=1&view=desktop#/');
    await p.getByRole('navigation',{name:'桌面主导航',exact:true}).waitFor();
    assert(await p.locator('.mobile-main-navigation').count()===0,'Mobile navigation leaked into desktop');
    checks.push('Desktop retains its own navigation');
    assert(errors.length===0,errors.join('\n'));
    return {engine,checks:checks.length,details:checks,errors};
  } catch(error) {
    await p.screenshot({path:`output/playwright/navigation-${engine}-failure.png`,fullPage:true});
    throw new Error(JSON.stringify({checks,error:String(error),errors,url:p.url(),text:(await p.locator('body').innerText()).slice(0,1200)}));
  } finally {releaseRecommendation?.();await context.close()}
}
