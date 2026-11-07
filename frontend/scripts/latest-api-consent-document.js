async(page)=>{
 const base='http://127.0.0.1:5173',checks=[],errors=[],writes=[],documents=[],assets=[],guard=u=>u.origin===base&&u.pathname.startsWith('/api/');
 const saved=await page.evaluate(()=>({session:localStorage.getItem('eatwhat-session'),demo:localStorage.getItem('eatwhat-demo-session')}));
 const err=e=>errors.push(e.message);page.on('pageerror',err);
 let mode='hold',release,version=3;
 const valid=()=>'<main><h1>完整政策验收</h1><p>policy-v'+version+'</p><h2>撤回与保留</h2><p>这是完整正文。可在设置中撤回。</p><a href="./withdraw.html">撤回说明</a><script>window.policyAttack=true</script><img src="https://policy-track.invalid/pixel" onerror="window.policyAttack=true"><p style="display:none" onclick="window.policyAttack=true">可读说明</p></main>';
 const ok=data=>({code:0,data,msg:'ok'});
 await page.route('https://policy-track.invalid/**',route=>{assets.push(route.request().url());return route.abort();});
 await page.route(guard,async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.slice(4);
  if(req.method()!=='GET'){writes.push(req.method()+' '+path);return route.abort();}
  if(path.startsWith('/policies/')){
   documents.push({path,headers:req.headers()});
   if(mode==='hold')await new Promise(resolve=>release=resolve);
   if(mode==='offline')return route.abort('internetdisconnected');
   if(mode==='503')return route.fulfill({status:503,contentType:'text/html',body:'服务器错误'});
   const body=mode==='empty'?'<div id="root"></div>':mode==='old'?'<p>policy-v1 旧版本</p>':valid();
   return route.fulfill({status:200,contentType:'text/html',headers:{'X-Frame-Options':'DENY'},body});
  }
  let data=null;
  if(path==='/auth/consent/policy')data={policyVersion:'policy-v'+version,siteMode:'EXTERNAL',notice:{title:'政策验收',documentPath:'/policies/policy-v'+version+'.html',documentSha256:'hash-'+version}};
  if(path==='/campus/list')data=[];
  return route.fulfill({contentType:'application/json',body:JSON.stringify(ok(data))});
 });
 const visit=async(view='desktop')=>{
  await page.evaluate(()=>localStorage.removeItem('eatwhat-session'));
  await page.goto(base+'/?demo=0&view='+view+'#/auth/password');await page.reload();
  await page.getByRole('button',{name:'《跨站同步授权政策》',exact:true}).waitFor();
 };
 const open=()=>page.getByRole('button',{name:'《跨站同步授权政策》',exact:true}).click();
 const article=()=>page.getByRole('article',{name:'完整跨站同步授权政策',exact:true});
 const retry=()=>page.getByRole('button',{name:'重试正文',exact:true}).click();
 try{
  await page.setViewportSize({width:1440,height:1000});await visit();if(documents.length)throw new Error('未打开已加载正文');
  await open();await page.getByRole('status').filter({hasText:'正在加载完整政策正文…'}).waitFor();
  mode='503';release();await page.getByRole('alert').filter({hasText:'HTTP 503'}).waitFor();
  await page.screenshot({path:'output/playwright/consent-document-error.png'});
  checks.push('正文按需加载，加载提示和 HTTP 失败反馈');
  mode='empty';await retry();await page.getByRole('alert').filter({hasText:'正文为空'}).waitFor();
  mode='old';await retry();await page.getByRole('alert').filter({hasText:'版本不一致'}).waitFor();
  mode='offline';await retry();await page.getByRole('alert').filter({hasText:'检查网络'}).waitFor();
  checks.push('空白 HTML、错误版本、网络中断均提示并可重试');
  mode='valid';await retry();await article().getByRole('heading',{name:'撤回与保留',exact:true}).waitFor();
  if(await page.locator('iframe').count()||await article().locator('script,img,[onclick],[style]').count())throw new Error('不安全正文');
  if(await page.evaluate(()=>!!window.policyAttack)||assets.length)throw new Error('执行脚本或请求跟踪资源');
  if(await article().getByRole('link',{name:'撤回说明'}).getAttribute('href')!==base+'/api/policies/withdraw.html')throw new Error('相对链接解析错误');
  checks.push('禁止 iframe 的响应仍可阅读，脚本、远程资源和样式不进入应用');
  await page.getByRole('button',{name:'关闭正文',exact:true}).click();if(await page.getByRole('checkbox',{name:'我已阅读并同意跨站同步授权政策',exact:true}).isChecked())throw new Error('关闭自动同意');
  await open();await article().waitFor();await page.getByRole('button',{name:'关闭正文',exact:true}).click();checks.push('重开正文正常，关闭不自动同意');
  version=4;mode='hold';await visit();await open();await page.getByRole('status').filter({hasText:'正在加载完整政策正文…'}).waitFor();await page.getByRole('button',{name:'关闭正文',exact:true}).click();mode='valid';release();await open();await article().getByText('policy-v4',{exact:true}).waitFor();checks.push('关闭期间的请求取消后，可重新打开当前版本正文');
  for(const width of [360,390,430]){
   await page.getByRole('button',{name:'关闭正文',exact:true}).click();await page.setViewportSize({width,height:844});await visit('mobile');await open();await article().getByRole('heading',{name:'撤回与保留',exact:true}).waitFor();
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)||await article().evaluate(el=>el.scrollWidth>el.clientWidth+1))throw new Error('移动正文溢出 '+width);
  }
  checks.push('360、390、430 宽度移动端正文正常');
  if(errors.length||writes.length||documents.some(d=>d.headers.authorization||d.headers['x-consent-test']))throw new Error(JSON.stringify({errors,writes,documents}));
  return{checks,documentRequests:documents.length,pageErrors:errors,realBackendRequests:0,realBackendWrites:0,remoteAssetRequests:assets.length};
 }finally{
  if(release)release();await page.goto(base+'/?demo=1&view=desktop#/');await page.evaluate(saved=>{for(const [key,value]of [['eatwhat-session',saved.session],['eatwhat-demo-session',saved.demo]])value===null?localStorage.removeItem(key):localStorage.setItem(key,value);},saved);await page.setViewportSize({width:1440,height:1000});await page.unroute(guard);await page.unroute('https://policy-track.invalid/**');page.off('pageerror',err);
 }
}
