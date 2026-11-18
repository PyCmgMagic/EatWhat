async (page) => {
 const base='http://127.0.0.1:5173',errors=[],checks=[],screens=[];
 const onError=error=>errors.push(error.message);page.on('pageerror',onError);
 const paths=['/notifications','/verify','/settings/account','/settings/password','/settings/privacy','/settings/bind-phone','/users/21','/follows','/restaurants/new','/restaurants/new/details','/settings/about','/data-notice','/auth','/auth/password','/auth/username-register','/auth/consent','/auth/register','/auth/register/confirm','/auth/forgot','/settings/phone','/settings/devices','/settings/delete','/settings/blocked','/settings/notifications','/feedback','/restaurants/correction','/topics','/topics/current'];
 const savedSession=await page.evaluate(()=>localStorage.getItem('eatwhat-demo-session'));
 const dialog=async d=>{if(d.type()==='beforeunload')await d.accept();else await d.dismiss();};page.on('dialog',dialog);
 try{
  await page.evaluate(()=>localStorage.setItem('eatwhat-demo-session',JSON.stringify({tokenName:'satoken',tokenValue:'isolated-demo-token'})));await page.reload();
  for(const width of [1024,1280,1440,1920]){
   await page.setViewportSize({width,height:1000});
   for(const path of paths){
    await page.goto(base+'/?demo=1&view=desktop#'+path);await page.locator('[data-pc-secondary]').first().waitFor();
    const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,legacy:!!document.querySelector('.pc-source-page,.pc-main .design-screen'),title:document.title,content:!!document.querySelector('main h1,main h2')}));
    if(result.overflow||result.legacy||!result.content)throw new Error(JSON.stringify({width,path,...result}));
    if(path==='/settings/bind-phone'&&!result.title.startsWith('绑定手机号'))throw new Error('补充路由标题错误');
    screens.push({width,path});
   }
  }
  checks.push('28 个入口 × 4 种 PC 宽度：原生桌面内容，无旧画板、横向溢出或空白页面');
  await page.setViewportSize({width:760,height:900});
  for(const path of ['/settings/account','/settings/privacy','/notifications','/users/21','/restaurants/new','/auth/forgot']){
   await page.goto(base+'/?demo=1&view=desktop#'+path);await page.locator('[data-pc-secondary]').first().waitFor();
   await page.waitForFunction(()=>Math.abs(document.querySelector('.pc-app').getBoundingClientRect().width-760)<2);
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('760 缩放溢出 '+path);
  }
  checks.push('760px 强制桌面缩放预览');
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/notifications','/settings/privacy','/users/21']){
   await page.goto(base+'/?demo=1&view=mobile#'+path);await page.locator('.design-screen').waitFor();
   if(await page.locator('.pc-app').count())throw new Error('移动端被替换');
  }
  checks.push('通知、隐私、他人主页的移动端源画板保留');
  await page.setViewportSize({width:1440,height:1000});
  for(const [path,name,selector] of [['/settings/account','account','.pc-secondary-identity'],['/settings/password','password','input[name=old]'],['/settings/bind-phone','binding','#bind-mobile'],['/verify','verify','.pc-secondary-verification'],['/restaurants/new','new-shop','input[type="search"][aria-label="搜索店名或地址"]'],['/follows','follows','.pc-secondary-list-toolbar'],['/settings/devices','devices','.pc-secondary-availability']]){
   await page.goto(base+'/?demo=1&view=desktop#'+path);await page.locator(selector).waitFor();await page.screenshot({path:'output/playwright/pc-secondary-'+name+'.png'});
  }
  await page.evaluate(()=>localStorage.setItem('eatwhat-demo-session','null'));await page.reload();
  for(const [path,name,selector] of [['/auth/password','login','input[name=username]'],['/auth/username-register','register','input[aria-label="登录手机号"]'],['/auth/forgot','forgot','.pc-secondary-availability']]){
   await page.goto(base+'/?demo=1&view=desktop#'+path);await page.locator(selector).waitFor();await page.screenshot({path:'output/playwright/pc-secondary-'+name+'.png'});
  }
  await page.goto(base+'/?demo=1&view=desktop#/auth/password');await page.getByRole('button',{name:'使用演示账号登录',exact:true}).click();await page.locator('.pc-hero').waitFor();
  checks.push('专用登录表单、注册表单及演示账号登录');
  if(errors.length)throw new Error(errors.join('\n'));
  return {checks,widthChecks:screens.length,previewChecks:6,mobileChecks:3,pageErrors:errors};
 }finally{
  await page.evaluate(value=>value===null?localStorage.removeItem('eatwhat-demo-session'):localStorage.setItem('eatwhat-demo-session',value),savedSession);
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/?demo=1&view=desktop#/settings/account');await page.reload();page.off('pageerror',onError);page.off('dialog',dialog);
 }
}
