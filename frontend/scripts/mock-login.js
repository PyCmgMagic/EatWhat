async(page)=>{
 const base='http://127.0.0.1:5173',checks=[],requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.url())});
 // Guard the test against accidental backend traffic, including live-mode checks.
 await page.unroute('**/api/**');
 const isApi=url=>url.pathname.startsWith('/api/');
 await page.route(isApi,r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:503,msg:'QA network guard',data:null})}));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/?view=desktop');
 const realSession=await page.evaluate(()=>sessionStorage.getItem('eatwhat-session'));
 try{
  await page.evaluate(()=>{sessionStorage.removeItem('eatwhat-demo-session');sessionStorage.removeItem('eatwhat-session')});
  await page.reload();
  await page.getByRole('heading',{name:'鲜虾蟹籽 云吞'}).waitFor();
  if(!await page.evaluate(()=>JSON.parse(sessionStorage.getItem('eatwhat-demo-session'))?.tokenValue==='isolated-demo-token'))throw new Error('Default Mock session missing');
  checks.push('无 demo 参数默认 Mock，自动登录模拟学生');
  await page.goto(base+'/?view=desktop#/settings');
  await page.getByRole('button',{name:'退出登录',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'退出登录',exact:true}).click();
  await page.waitForURL('**#/auth');
  await page.getByRole('button',{name:'使用演示账号登录',exact:true}).waitFor();
  await page.reload();
  await page.getByRole('banner').getByRole('link',{name:'登录',exact:true}).waitFor();
  checks.push('主动退出后刷新仍保持未登录');
  await page.goto(base+'/?view=desktop#/auth/password?next=%2Ffavorites');
  const button=page.getByRole('button',{name:'使用演示账号登录',exact:true});
  await button.waitFor();
  if(await button.evaluate(el=>getComputedStyle(el).color)!=='rgb(35, 28, 24)')throw new Error('Mock button text contrast');
  await page.screenshot({path:'output/playwright/mock-login-desktop.png'});
  await button.click();await page.waitForURL('**#/favorites');
  await page.getByRole('banner').getByRole('link',{name:'我的主页',exact:true}).waitFor();
  await page.reload();await page.getByRole('banner').getByRole('link',{name:'我的主页',exact:true}).waitFor();
  checks.push('PC 一键登录、恢复目标页和刷新会话');
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/?view=mobile#/auth/password?next=%2Ffavorites');
  await page.getByRole('button',{name:'一键 Mock 登录',exact:true}).waitFor();
  await page.screenshot({path:'output/playwright/mock-login-mobile.png'});
  await page.getByRole('button',{name:'一键 Mock 登录',exact:true}).click();await page.waitForURL('**#/favorites');
  await page.goto(base+'/?view=mobile#/auth');
  await page.getByRole('button',{name:'一键 Mock 登录',exact:true}).click();await page.waitForURL('**#/');
  checks.push('移动端密码页和欢迎页一键 Mock 登录');
  if(await page.evaluate(()=>sessionStorage.getItem('eatwhat-session'))!==null)throw new Error('Mock leaked into live session');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'/?demo=0&view=desktop#/auth/password');
  await page.getByRole('banner').getByRole('link',{name:'登录',exact:true}).waitFor();
  if(await page.getByRole('button',{name:'使用演示账号登录',exact:true}).count())throw new Error('Mock entry in live mode');
  checks.push('demo=0 保留真实登录，Mock 不污染真实会话');
  await page.goto('http://127.0.0.1:5174/?demo=1&view=desktop#/auth/password');
  await page.getByRole('heading',{name:'登录，开启今日份美味',exact:true}).waitFor();
  if(await page.getByRole('button',{name:'使用演示账号登录',exact:true}).count())throw new Error('Production Mock enabled without build flag');
  checks.push('生产包默认禁用 Mock，URL 参数不能单独开启');
  if(requests.length)throw new Error('Unexpected API requests: '+requests.join(','));
  if(errors.length)throw new Error(errors.join('\n'));
  return {checks,apiRequests:requests.length,errors};
 }finally{
  await page.goto(base+'/?view=desktop');
  await page.evaluate(v=>{if(v===null)sessionStorage.removeItem('eatwhat-session');else sessionStorage.setItem('eatwhat-session',v)},realSession);
  await page.unroute(isApi);
 }
}
