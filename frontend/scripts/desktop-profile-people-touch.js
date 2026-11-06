async(page)=>{
 const context=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),phone=await context.newPage(),checks=[],errors=[],requests=[];
 phone.on('pageerror',e=>errors.push(e.message));await phone.route(u=>u.pathname.startsWith('/api/'),r=>{requests.push(r.request().url());return r.abort()});
 try{
  await phone.goto('http://127.0.0.1:5173/?demo=1&view=mobile#/me');await phone.getByRole('link',{name:/粉丝/}).first().tap();await phone.getByRole('dialog',{name:'关注与粉丝',exact:true}).waitFor();
  if(!phone.url().includes('#/me?people=fans'))throw new Error('手机入口仍然跳独立页');await phone.getByRole('tab',{name:/^关注/}).tap();await phone.waitForFunction(()=>[...document.querySelectorAll('.profile-people-toolbar [role=tab]')].some(e=>e.textContent.startsWith('关注')&&e.getAttribute('aria-selected')==='true'));
  await phone.getByRole('button',{name:'关闭关注与粉丝'}).tap();await phone.waitForFunction(()=>!document.querySelector('.profile-people-dialog').open&&document.body.style.overflow!=='hidden');checks.push('触屏从我的主页打开、切换与关闭，保留主页');
  await phone.goto('http://127.0.0.1:5173/?demo=1&view=mobile#/users/21');await phone.getByRole('link',{name:/粉丝/}).first().tap();await phone.getByRole('dialog',{name:'TA 的关注与粉丝',exact:true}).waitFor();
  if(!phone.url().includes('#/users/21?people=fans'))throw new Error('手机他人主页入口错位');
  await phone.touchscreen.tap(5,10);await phone.waitForFunction(()=>!document.querySelector('.profile-people-dialog').open&&document.body.style.overflow!=='hidden');checks.push('他人主页内打开、触屏点击遮罩关闭');
  if(errors.length||requests.length)throw new Error(JSON.stringify({errors,requests}));const result={checks,pageErrors:errors,realBackendRequests:requests.length,physicalTouchDevice:false};await page.evaluate(r=>sessionStorage.setItem('eatwhat-qa-profile-people-touch',JSON.stringify(r)),result);return result;
 }catch(error){await phone.screenshot({path:'output/playwright/profile-people-touch-failure.png'});throw error}finally{await context.close()}
}
