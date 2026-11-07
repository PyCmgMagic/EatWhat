async(page)=>{
 const base='http://127.0.0.1:5173',checks=[],calls=[];let mode='consent',failure='empty';
 const ok=data=>({code:0,msg:'success',data}),empty={items:[],currentPage:1,totalItems:0,totalPages:0,hasNext:false};
 await page.route(url=>url.origin===base&&url.pathname.startsWith('/api/'),async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.slice(4);calls.push({path,token:req.headers()['x-mobile-test']});let status=200,result=ok(empty);
  if(path==='/auth/login')result=mode==='consent'?{code:20005,msg:'需要授权',data:{consentProof:'mobile-proof',status:'PENDING',policyVersion:'test-v1'}}:ok({tokenName:'x-mobile-test',tokenValue:'mobile-session',isLogin:true});
  else if(path==='/auth/consent/policy')result=ok({policyVersion:'test-v1',siteMode:'EXTERNAL'});
  else if(path==='/user/info')result=ok({id:123,userName:'验收食友',verified:true,role:'user'});
  else if(path==='/foods/favorites'){if(failure==='business')result={code:777,msg:'验收：业务失败',data:null};if(failure==='expired'){status=401;result={code:401,msg:'验收：会话过期',data:null}}}
  else if(path==='/foods/detail/9'){status=403;result={code:403,msg:'验收：无权访问',data:null}}
  else if(path==='/foods/tags/my')result=ok(empty);
  else if(path==='/notification/unread/count')result=ok(0);
  else result={code:404,msg:'验收中拦截了未配置端点',data:null};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
 const previous=await page.evaluate(()=>localStorage.getItem('eatwhat-session'));
 await page.evaluate(()=>localStorage.removeItem('eatwhat-session'));
 try{
  await page.goto(base+'/?demo=0#/favorites');await page.getByRole('button',{name:'登录',exact:true}).waitFor();
  if(calls.length)throw new Error('Guest requested protected data');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  const login=async()=>{await page.getByRole('textbox',{name:'手机号或用户名',exact:true}).fill('mobile_test');await page.locator('#pwd').fill('test-password');await page.getByRole('link',{name:'登录',exact:true}).click()};
  await login();await page.getByRole('heading',{name:'再确认一次',exact:true}).waitFor();
  if(await page.evaluate(()=>JSON.parse(localStorage.getItem('eatwhat-session'))))throw new Error('Proof incorrectly stored as session');
  if(!await page.getByRole('button',{name:'同意并继续'}).isDisabled())throw new Error('Missing policy did not block consent');checks.push('访客不请求受保护内容；临时授权凭证不成为会话');
  mode='session';await page.goto(base+'/?demo=0#/auth/password?next=%2Ffavorites');await login();
  await page.getByRole('heading',{name:'这一页暂时没有这类收藏',exact:true}).waitFor();
  if(!calls.some(c=>c.path==='/foods/favorites'&&c.token==='Bearer mobile-session'))throw new Error('Dynamic header missing');checks.push('登录恢复目标页；使用后端返回的 tokenName');
  failure='business';await page.reload();await page.getByText('验收：业务失败',{exact:true}).waitFor();checks.push('HTTP 200 非零业务码展示错误');
  await page.goto(base+'/?demo=0#/foods/9');await page.getByText('验收：无权访问',{exact:true}).waitFor();
  if(!await page.evaluate(()=>JSON.parse(localStorage.getItem('eatwhat-session'))))throw new Error('403 cleared session');checks.push('403 权限失败保留会话');
  failure='expired';await page.goto(base+'/?demo=0#/favorites');await page.getByRole('button',{name:'登录',exact:true}).waitFor();
  if(await page.evaluate(()=>JSON.parse(localStorage.getItem('eatwhat-session'))))throw new Error('401 did not clear session');checks.push('401 清除失效会话');
 }finally{await page.unrouteAll({behavior:'wait'});await page.evaluate(value=>{if(value)localStorage.setItem('eatwhat-session',value);else localStorage.removeItem('eatwhat-session')},previous);await page.goto(base+'/?demo=1')}
 return {checks,backendRequestsSent:0,intercepted:calls.length};
}
