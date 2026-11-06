async(page)=>{
 const errors=[],calls=[],origin='http://127.0.0.1:5174';
 const error=e=>errors.push(e.message),guard=u=>u.origin===origin&&u.pathname.startsWith('/api/');page.on('pageerror',error);
 await page.route(guard,r=>{calls.push(r.request().url());return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({code:0,data:[]})});});
 try{
  await page.goto(origin+'/?demo=1&view=desktop#/auth/password');await page.getByRole('button',{name:'登录',exact:true}).waitFor();
  if(await page.getByRole('button',{name:/Mock 登录|使用演示账号登录/}).count())throw new Error('生产仍开放 Mock 登录');
  if(await page.locator('.demo-switcher').count())throw new Error('生产仍开放演示身份切换');
  if(errors.length)throw new Error(JSON.stringify(errors));return{productionBoot:'passed',productionMockDisabled:true,pageErrors:errors,interceptedRequests:calls.length,realBackendRequests:0};
 }finally{await page.goto('http://127.0.0.1:5173/?demo=1&view=desktop#/');await page.unroute(guard);page.off('pageerror',error);}
}
