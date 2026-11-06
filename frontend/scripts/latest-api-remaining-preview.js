async(page)=>{
 const base='http://127.0.0.1:5173',calls=[],errors=[],guard=u=>u.origin===base&&u.pathname.startsWith('/api/'),err=e=>errors.push(e.message);page.on('pageerror',err);await page.route(guard,route=>{calls.push(route.request().url());return route.abort();});
 try{
  for(const view of ['desktop','mobile']){
   await page.setViewportSize({width:view==='desktop'?1440:390,height:view==='desktop'?1000:844});await page.goto(base+'/?demo=1&persona=admin&view='+view+'#/admin');await page.getByRole('button',{name:'跨站同步',exact:true}).click();await page.locator('.sync-record').first().click();await page.locator('.sync-editor').getByLabel('处理方式',{exact:true}).selectOption('KEEP');await page.locator('.sync-editor').getByLabel('保留的候选版本',{exact:true}).selectOption({index:1});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'output/playwright/remaining-sync-'+view+'.png',fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/?demo=1&view=desktop#/auth/withdraw-consent');await page.getByRole('heading',{name:'使用密码撤回同步授权',exact:true}).waitFor();await page.screenshot({path:'output/playwright/remaining-withdraw-desktop.png',fullPage:true});
  if(calls.length||errors.length)throw new Error(JSON.stringify({calls,errors}));return{screenshots:3,realBackendRequests:0,pageErrors:errors};
 }finally{await page.goto(base+'/?demo=1&view=desktop#/');await page.setViewportSize({width:1440,height:1000});await page.unroute(guard);page.off('pageerror',err);}
}
