async(page)=>{
 const base='http://127.0.0.1:5173',errors=[],writes=[],requests=[],guard=u=>u.origin===base&&u.pathname.startsWith('/api/');
 const saved=await page.evaluate(()=>localStorage.getItem('eatwhat-session')),err=e=>errors.push(e.message);page.on('pageerror',err);
 await page.route(guard,route=>{const req=route.request();if(!['GET','HEAD','OPTIONS'].includes(req.method())){writes.push(req.method()+' '+req.url());return route.abort();}requests.push(req.url());return route.continue();});
 const checks=[];
 try{
  await page.evaluate(()=>localStorage.removeItem('eatwhat-session'));
  for(const view of ['desktop','mobile']){
   await page.setViewportSize({width:view==='desktop'?1440:390,height:view==='desktop'?1000:844});
   await page.goto(base+'/?demo=0&view='+view+'#/auth/password');await page.reload();
   const docResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/policies/cross-border-preferences-v3.html');
   await page.getByRole('button',{name:'《跨站同步授权政策》',exact:true}).click();
   const article=page.getByRole('article',{name:'完整跨站同步授权政策',exact:true});
   await article.getByRole('heading',{name:'EatWhat 跨站数据同步授权说明（含浏览与手动口味）',exact:true}).waitFor();
   await article.getByRole('heading',{name:'保留记录与访问路径',exact:true}).waitFor();
   const response=await docResponse,html=await response.text();
   const equal=await article.evaluate((element,html)=>{
    const original=new DOMParser().parseFromString(html,'text/html').querySelector('main');
    const normalize=text=>text.replace(/\s+/g,' ').trim();
    return original&&normalize(original.textContent)===normalize(element.textContent);
   },html);
   if(!equal)throw new Error('完整正文与后端内容不同 '+view);
   if(await page.locator('iframe').count())throw new Error('仍依赖嵌入页面');
   await page.locator('.ew-policy-scroll').evaluate(el=>{el.scrollTop=el.querySelector('.ew-policy-full').offsetTop-el.offsetTop-12;});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)||await article.evaluate(el=>el.scrollWidth>el.clientWidth+1))throw new Error('正文横向溢出 '+view);
   await page.screenshot({path:'output/playwright/consent-live-'+view+'.png'});
   await page.getByRole('button',{name:'关闭正文',exact:true}).click();
   if(await page.getByRole('checkbox',{name:'我已阅读并同意跨站同步授权政策',exact:true}).isChecked())throw new Error('打开正文自动同意');
   checks.push(view+'真实正文逐字一致，末节完整，无 iframe 或横向溢出，关闭不自动同意');
  }
  if(errors.length||writes.length)throw new Error(JSON.stringify({errors,writes}));return{checks,backendPolicy:'cross-border-preferences-v3',backendDocument:'passed',pageErrors:errors,realReadRequests:requests.length,realBackendWrites:0};
 }finally{await page.goto(base+'/?demo=1&view=desktop#/');await page.evaluate(saved=>saved===null?localStorage.removeItem('eatwhat-session'):localStorage.setItem('eatwhat-session',saved),saved);await page.setViewportSize({width:1440,height:1000});await page.unroute(guard);page.off('pageerror',err);}
}
