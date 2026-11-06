async(page)=>{
 const saved=await page.evaluate(()=>sessionStorage.getItem('eatwhat-demo-session')),base='http://127.0.0.1:5173';
 try{
  await page.evaluate(()=>sessionStorage.setItem('eatwhat-demo-session','null'));await page.setViewportSize({width:390,height:844});await page.goto(base+'/?demo=1&view=mobile#/auth');await page.reload();
  const box=()=>page.getByRole('checkbox',{name:'我已阅读并同意跨站同步授权政策',exact:true});
  await box().check();await page.getByRole('link',{name:'登录',exact:true}).click();await page.waitForURL('**#/auth/password');if(await box().isChecked())throw new Error('新表单预选');await box().check();await page.getByRole('button',{name:'一键 Mock 登录',exact:true}).click();await page.waitForURL('**#/');
  return{mobileWelcomeAndMockLogin:'passed',newFormUnchecked:true};
 }finally{await page.evaluate(saved=>saved===null?sessionStorage.removeItem('eatwhat-demo-session'):sessionStorage.setItem('eatwhat-demo-session',saved),saved);await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/?demo=1&view=desktop#/');await page.reload();}
}
