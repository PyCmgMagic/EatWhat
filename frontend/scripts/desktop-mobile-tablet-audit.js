async(page)=>{
 const routes=['/','/nearby','/me','/notifications','/foods/1','/restaurants/1','/publish','/publish/dish','/restaurants/new','/restaurants/new/details','/auth','/auth/password','/auth/username-register','/auth/register','/auth/register/confirm','/auth/forgot','/auth/consent','/auth/withdraw-consent','/data-notice','/verify','/search','/users/21','/me/edit','/me/details','/me/tags','/favorites','/foods/1/edit','/history','/settings','/settings/account','/settings/password','/settings/phone','/settings/devices','/settings/delete','/settings/privacy','/settings/preferences','/settings/blocked','/settings/notifications','/settings/about','/settings/bind-phone','/feedback','/restaurants/correction','/comments','/comments/write'];
 const rows=[],errors=[],requests=[],onError=e=>errors.push(e.message),guard=u=>u.pathname.startsWith('/api/');page.on('pageerror',onError);await page.route(guard,r=>{requests.push(r.request().url());return r.abort()});await page.emulateMedia({reducedMotion:'reduce'});
 try{
  for(const [width,height] of [[320,568],[390,667],[430,932],[600,960],[768,1024],[820,1180],[1024,768],[667,375],[844,390]]){
   for(const path of routes){
    await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5173/?demo=1#'+path);await page.locator('.pc-app,.mobile-viewport,.ew-mobile-feature,.mobile-page-native').first().waitFor();
    await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
    if(path==='/me')await page.locator('.pc-profile-card h1,.design-screen[data-screen="G-Me"] h1').first().waitFor();
    if(path==='/restaurants/1')await page.locator('.pc-food-card,.mobile-food-carousel .design-food-tile').first().waitFor();
    if(path==='/notifications')await page.locator('.pc-secondary-message,.mobile-notification').first().waitFor();
    if(path==='/search'||path==='/favorites')await page.locator('.ew-food-card').first().waitFor();
    await page.waitForFunction(()=>![...document.querySelectorAll('[role=status],.mobile-status,.pc-status')].some(e=>e.checkVisibility()&&/正在(准备|加载|查询)/.test(e.textContent)),{timeout:5000}).catch(()=>{});
    const data=await page.evaluate(async()=>{
     const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&e.checkVisibility()&&!e.closest('[inert],[aria-hidden=true]');
     const root=document.querySelector('.pc-main')||document.querySelector('.mobile-viewport,.ew-mobile-feature,.mobile-page-native');
     const smallScroll=[...root.querySelectorAll('*')].filter(e=>visible(e)&&/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+3&&e.clientHeight<80).map(e=>({tag:e.tagName,cls:e.className,h:e.clientHeight,sh:e.scrollHeight,text:e.textContent.slice(0,35)}));
     const horizontal=[...root.querySelectorAll('form,fieldset,.ew-form-panel,.pc-secondary-section,.mobile-page-native')].filter(e=>visible(e)&&e.scrollWidth>e.clientWidth+3).map(e=>({tag:e.tagName,cls:e.className,w:e.clientWidth,sw:e.scrollWidth}));
     const controls=[...root.querySelectorAll('input:not([type=hidden]):not([type=file]),textarea,select,button,a[href]')].filter(e=>visible(e)&&!e.disabled);
     const check=[...new Set([...controls.filter(e=>e.matches('input,textarea,select')).slice(-3),...controls.slice(-4)])];
     const blocked=[];
     for(const e of check){e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});await new Promise(r=>requestAnimationFrame(r));const r=e.getBoundingClientRect();let l=Math.max(0,r.left),t=Math.max(0,r.top),right=Math.min(innerWidth,r.right),b=Math.min(innerHeight,r.bottom);const x=(l+right)/2,y=(t+b)/2,hit=document.elementFromPoint(x,y);if(right-l<4||b-t<4||!hit||!(hit===e||e.contains(hit)||hit.closest('label')?.contains(e))){blocked.push({tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,25)||e.name||e.id,w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y),hit:hit?.tagName+':'+(hit?.className||'')});}}
     for(const el of root.querySelectorAll('*')){if(el.scrollTop)el.scrollTop=0;if(el.scrollLeft)el.scrollLeft=0;}window.scrollTo({top:0,left:0,behavior:'instant'});return {scroll:document.documentElement.scrollWidth,desktop:!!document.querySelector('.pc-app'),smallScroll,horizontal,blocked};
    });
    const row={path,width,height,...data};rows.push(row);
    if(width===390&&['/auth/password','/publish/dish','/settings/account','/me/details','/foods/1','/restaurants/new','/comments'].includes(path)||width===600&&path==='/me'||width===820&&['/settings/account','/auth/username-register','/users/21','/foods/1'].includes(path))await page.screenshot({path:'output/playwright/mobile-audit-'+width+'-'+path.replace(/\W+/g,'-')+'.png',fullPage:true});
   }
  }
  const failures=rows.filter(r=>r.scroll>r.width+1||r.smallScroll.length||r.horizontal.length||r.blocked.length);const result={checks:rows.length,failures,errors,networkRequests:requests.length,rows};await page.evaluate(r=>sessionStorage.setItem('eatwhat-mobile-tablet-audit',JSON.stringify(r)),result);return {checks:rows.length,failures,errors,networkRequests:requests.length};
 }finally{await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:5173/?demo=1#/me');await page.unroute(guard);page.off('pageerror',onError)}
}
