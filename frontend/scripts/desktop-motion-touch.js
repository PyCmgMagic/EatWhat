async(page)=>{
 const context=await page.context().browser().newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),phone=await context.newPage(),checks=[],errors=[],requests=[];
 phone.on('pageerror',e=>errors.push(e.message));await phone.route(u=>u.pathname.startsWith('/api/'),r=>{requests.push(r.request().url());return r.abort()});
 try{
  await phone.goto('http://127.0.0.1:5173/?demo=1&view=mobile#/');await phone.getByRole('heading',{name:'鲜虾蟹籽 云吞'}).waitFor();
  if(!await phone.evaluate(()=>matchMedia('(hover: none) and (pointer: coarse)').matches))throw new Error('未启用触屏环境');
  const shuffle=phone.getByRole('button',{name:'换一个',exact:true});await shuffle.tap();await phone.getByRole('heading',{name:'番茄 牛腩饭'}).waitFor();
  const tab=phone.getByRole('tab',{name:'甜品',exact:true});await tab.tap();await phone.waitForFunction(()=>document.querySelector('.mobile-data-grid')?.getAttribute('aria-busy')==='false');
  if(!await tab.isVisible())throw new Error('空分类丢失切换入口');checks.push('真实触屏事件模拟换菜与空分类切换');
  const opener=phone.locator('a[href="#/panels/place"]');await opener.tap();await phone.getByRole('dialog',{name:'地点和饭点',exact:true}).waitFor();await phone.getByRole('link',{name:'关闭',exact:true}).tap();await phone.locator('.mobile-panel-layer').waitFor({state:'detached'});checks.push('触屏打开面板、点击关闭与遮罩移除');
  await phone.getByRole('navigation',{name:'主导航',exact:true}).getByRole('link',{name:'附近',exact:true}).tap();await phone.getByRole('navigation',{name:'主导航',exact:true}).getByRole('link',{name:'发现',exact:true}).tap();
  const tile=phone.locator('.design-food-tile').first();await tile.waitFor();
  if(await tile.locator('img').evaluate(e=>getComputedStyle(e).transform)!=='none')throw new Error('触屏残留悬停放大');
  await phone.screenshot({path:'output/playwright/motion-touch-home.png'});checks.push('触屏导航切换、无粘连悬停效果');
  if(errors.length||requests.length)throw new Error(JSON.stringify({errors,requests}));const result={checks,errors,realBackendRequests:requests.length,physicalTouchDevice:false};await page.evaluate(r=>sessionStorage.setItem('eatwhat-qa-motion-touch',JSON.stringify(r)),result);return result;
 }finally{await context.close()}
}
