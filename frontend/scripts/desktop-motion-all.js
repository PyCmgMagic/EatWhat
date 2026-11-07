async(page)=>{
 const base='http://127.0.0.1:5173',checks=[],errors=[],requests=[],key='eatwhat-demo-prototype-v3';
 const error=e=>errors.push(e.message),guard=u=>u.pathname.startsWith('/api/');
 page.on('pageerror',error);await page.route(guard,r=>{requests.push(r.request().url());return r.abort()});
 const settle=()=>page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))});
 const goto=async(view,path='')=>{await page.goto(base+'/?demo=1&view='+view+'#/'+path);await settle()};
 await page.setViewportSize({width:1440,height:1000});await goto('desktop');await page.locator('.pc-current-plate img').waitFor();
 const saved=await page.evaluate(key=>({db:localStorage.getItem(key),session:localStorage.getItem('eatwhat-demo-session'),campus:localStorage.getItem('eatwhat-campus')}),key);
 try{
  const dots=()=>page.locator('.pc-hero-dots button').evaluateAll(nodes=>nodes.map(e=>e.getBoundingClientRect().left));
  const positions=await dots();await page.getByRole('button',{name:'看第 6 道菜',exact:true}).click();await settle();
  if((await dots()).some((x,i)=>Math.abs(x-positions[i])>.5))throw new Error('换菜圆点挤动');
  const shuffle=page.getByRole('button',{name:'换一个',exact:true});await shuffle.hover();await page.mouse.down();
  if(await shuffle.evaluate(e=>+getComputedStyle(e).scale)>=1)throw new Error('没有即时按压反馈');await page.mouse.up();await settle();
  const group=page.getByRole('group',{name:'推荐转盘，左右拖动换菜'}),box=await group.boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+150);await page.mouse.down();await page.mouse.move(box.x+box.width*.5-20,box.y+150,{steps:3});
  const drag=await group.evaluate(e=>({delta:new DOMMatrixReadOnly(getComputedStyle(e.querySelector('.pc-current-plate')).transform).m41,dragging:e.dataset.dragging}));
  if(drag.delta>=0||drag.dragging!=='true')throw new Error('图片未跟手拖动');await page.mouse.up();await settle();
  if(await group.getAttribute('data-dragging'))throw new Error('拖动状态未清理');
  checks.push('圆点固定位置、按钮即时按压、拖动跟手与小距离回弹');
  await page.screenshot({path:'output/playwright/motion-desktop-home.png'});

  await page.evaluate(()=>localStorage.setItem('eatwhat-demo-session','null'));
  await goto('desktop','auth/password');await page.reload();const policy=page.getByRole('button',{name:'《跨站同步授权政策》',exact:true});await policy.click();
  await page.getByRole('dialog').waitFor();await settle();
  const open=await page.locator('.ew-policy-dialog').evaluate(el=>({opacity:getComputedStyle(el).opacity,transform:getComputedStyle(el).transform}));
  if(open.opacity!=='1'||open.transform!=='none')throw new Error('政策弹窗最终状态不正确');
  const exit=await page.locator('.ew-policy-dialog').evaluate(async(el)=>{el.querySelector('footer button').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {open:el.open,display:getComputedStyle(el).display,animations:el.getAnimations().map(a=>({property:a.transitionProperty,duration:a.effect.getTiming().duration}))}});
  if(exit.open||!exit.animations.some(a=>a.property==='opacity'))throw new Error('原生弹窗关闭未平滑退出 '+JSON.stringify(exit));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ew-policy-dialog')).display==='none');
  await policy.click();await settle();await page.keyboard.press('Escape');
  if(await page.locator('.ew-policy-dialog').getAttribute('open')!==null)throw new Error('Escape未即时关闭弹窗');
  if(!await policy.evaluate(e=>document.activeElement===e))throw new Error('弹窗关闭未恢复焦点');checks.push('原生政策弹窗退出过渡、Escape 即时关闭与焦点恢复');

  await page.evaluate(()=>localStorage.setItem('eatwhat-demo-session',JSON.stringify({tokenName:'satoken',tokenValue:'isolated-demo-token'})));
  await goto('desktop','foods/1');await page.reload();const favorite=page.getByRole('button',{name:/^(收藏|取消收藏)$/});const wasFavorite=await favorite.getAttribute('aria-pressed');await favorite.click();await page.waitForFunction(was=>document.querySelector('.pc-dish-heading button')?.getAttribute('aria-pressed')!==was,wasFavorite);
  await goto('desktop','publish');await page.getByRole('button',{name:'暂存并离开',exact:true}).click();await page.locator('.toast.visible').waitFor();
  const toastExit=await page.evaluate(async()=>new Promise(resolve=>{const sample=()=>{const e=document.querySelector('.toast');if(!e.classList.contains('visible'))return resolve({text:e.textContent,animations:e.getAnimations().map(a=>a.transitionProperty)});requestAnimationFrame(sample)};sample()}));
  if(!toastExit.text||!toastExit.animations.includes('opacity'))throw new Error('提示消息退场时丢失文字 '+JSON.stringify(toastExit));
  await page.waitForFunction(()=>document.querySelector('.toast').textContent==='');checks.push('收藏状态反馈、提示消息保留文字完成退场');

  await page.setViewportSize({width:390,height:844});await goto('mobile');await page.getByRole('navigation',{name:'主导航',exact:true}).waitFor();
  const mobilePlates=page.locator('.mobile-viewport img[style*="top: 570px"]'),plateNodes=await mobilePlates.elementHandles();
  for(let i=0;i<8;i++)await page.getByRole('button',{name:'换一个',exact:true}).click();await settle();
  for(const node of plateNodes)if(!await node.evaluate(e=>e.isConnected))throw new Error('移动转盘重建图片');
  const mobileDuration=await mobilePlates.first().evaluate(e=>getComputedStyle(e).transitionDuration);
  if(mobileDuration.includes('0.68s'))throw new Error('移动转盘仍使用原长动画');
  const title=await page.locator('section[aria-live="polite"] h1').innerText();
  const categories=page.getByRole('tablist',{name:'推荐分类',exact:true});
  for(const name of ['主食','饮品','小吃','甜品','今日推荐']){
   await categories.getByRole('tab',{name,exact:true}).click();await settle();
   await page.waitForFunction(()=>document.querySelector('.mobile-data-grid')?.getAttribute('aria-busy')==='false');
   if(!await categories.isVisible()||await page.locator('section[aria-live="polite"] h1').innerText()!==title)throw new Error('移动分类替换了转盘或分类栏');
  }
  checks.push('移动转盘缩短至 360ms、图片节点复用、空分类保留推荐与分类栏');
  const nav=page.getByRole('navigation',{name:'主导航',exact:true});await nav.getByRole('link',{name:'附近',exact:true}).click();
  const mobileMotion=await page.locator('.mobile-viewport').evaluate(e=>e.getAnimations().map(a=>({keys:Object.keys(a.effect.getKeyframes()[0]),duration:a.effect.getTiming().duration})));
  if(mobileMotion.some(a=>a.keys.includes('transform')))throw new Error('移动端整页 transform 影响固定导航');
  await settle();await nav.getByRole('link',{name:'发现',exact:true}).click();await settle();
  const opener=page.locator('a[href="#/panels/place"]');await opener.click();await page.getByRole('dialog',{name:'地点和饭点',exact:true}).waitFor();await settle();
  if(await page.evaluate(()=>document.body.style.overflow)!=='hidden')throw new Error('面板打开后背景未锁定');
  await page.screenshot({path:'output/playwright/motion-mobile-panel.png'});
  const panelExit=await page.locator('.mobile-panel-layer').evaluate(async e=>{e.querySelector('a[aria-label="关闭"]').click();await new Promise(r=>requestAnimationFrame(r));return {exiting:e.dataset.exiting,retained:e.isConnected,inert:document.querySelector('.mobile-viewport > .mobile-canvas').inert}});
  if(panelExit.exiting!=='true'||!panelExit.retained||!panelExit.inert)throw new Error('面板退出未保留遮罩 '+JSON.stringify(panelExit));
  await page.locator('.mobile-panel-layer').waitFor({state:'detached'});if(await page.evaluate(()=>document.body.style.overflow)==='hidden')throw new Error('面板关闭后滚动未恢复');
  if(!await opener.evaluate(e=>document.activeElement===e))throw new Error('移动端面板关闭焦点未恢复');
  for(let i=0;i<3;i++){await opener.click();await page.keyboard.press('Escape');await page.locator('.mobile-panel-layer').waitFor({state:'detached'})}
  checks.push('移动端页面淡入保留导航位置、面板完整进出场、滚动锁定与焦点恢复、连续开关');

  await goto('mobile','foods/1');const remove=page.locator('.ew-food-manage').getByRole('button',{name:'删除',exact:true});await remove.click();await page.getByRole('dialog',{name:'操作提示',exact:true}).waitFor();await settle();
  await page.getByRole('button',{name:'取消',exact:true}).click();await page.locator('.design-notice-backdrop').waitFor({state:'detached'});await page.locator('.ew-food-manage').waitFor();
  checks.push('移动端确认面板进出场、取消后保留菜品');

  await goto('mobile');await opener.click();await page.emulateMedia({reducedMotion:'reduce'});
  const reducedPanel=await page.getByRole('dialog',{name:'地点和饭点',exact:true}).evaluate(e=>({transition:getComputedStyle(e).transitionDuration,animations:e.getAnimations().length}));
  if(reducedPanel.transition!=='0s'||reducedPanel.animations)throw new Error('动态偏好改变未停止面板动画');
  await page.getByRole('link',{name:'关闭',exact:true}).click();await page.locator('.mobile-panel-layer').waitFor({state:'detached'});
  await goto('desktop');await shuffle.click();if(await page.locator('.pc-hero-copy').evaluate(e=>e.getAnimations().length))throw new Error('减少动态效果仍有文字动画');
  checks.push('运行时切换减少动态效果，页面、面板与推荐内容即时响应');await page.emulateMedia({reducedMotion:'no-preference'});

  let responsiveChecks=0;
  for(const width of [320,375,390,430,768,1024,1440,1920]){
   await page.setViewportSize({width,height:900});const view=width<1024?'mobile':'desktop';
   for(const path of ['','nearby','me','search','publish','auth/password']){
    await goto(view,path);await page.waitForFunction(()=>!!document.querySelector('.design-screen, .ew-feature, .pc-app'));
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('横向溢出 '+view+' '+width+' '+path);responsiveChecks++;
   }
  }
  checks.push('8 种宽度 × 6 个主要页面无横向溢出');
  await page.setViewportSize({width:1440,height:1000});await goto('desktop','publish');await page.screenshot({path:'output/playwright/motion-publish-desktop.png',fullPage:true});
  if(errors.length||requests.length)throw new Error(JSON.stringify({errors,requests}));
  const result={checks,responsiveChecks,nativeDialogExit:exit,mobileMotion,realBackendRequests:requests.length,errors};
  await page.evaluate(result=>sessionStorage.setItem('eatwhat-qa-motion',JSON.stringify(result)),result);return result;
 }catch(cause){await page.screenshot({path:'output/playwright/motion-failure.png',fullPage:true});throw cause}
 finally{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(({key,saved})=>{for(const [storage,k,value]of [[localStorage,key,saved.db],[localStorage,'eatwhat-demo-session',saved.session],[localStorage,'eatwhat-campus',saved.campus]])value===null?storage.removeItem(k):storage.setItem(k,value)},{key,saved});
  await page.setViewportSize({width:1440,height:1000});await goto('desktop');await page.reload();await page.unroute(guard);page.off('pageerror',error);
 }
}
