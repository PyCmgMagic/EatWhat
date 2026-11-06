async(page)=>{
 const base='http://127.0.0.1:5173',calls=[],errors=[],blocked=[],pending=[];
 const error=e=>errors.push(e.message),guard=u=>u.origin===base&&u.pathname.startsWith('/api/');
 const response=r=>{if(guard(new URL(r.url())))pending.push(r.json().then(data=>calls.push({url:r.url(),status:r.status(),code:data.code,msg:data.msg})).catch(()=>calls.push({url:r.url(),status:r.status(),code:'NON_JSON'})));};
 await page.goto(base+'/?demo=1&view=desktop#/');const saved=await page.evaluate(()=>sessionStorage.getItem('eatwhat-session'));page.on('pageerror',error);page.on('response',response);
 await page.route(guard,r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){blocked.push(r.request().method()+' '+r.request().url());return r.abort();}return r.continue();});
 try{
  await page.evaluate(()=>sessionStorage.removeItem('eatwhat-session'));await page.goto(base+'/?demo=0&view=desktop#/search');
  await page.waitForFunction(()=>{const state=document.querySelector('.ew-feature .ew-state');return !!document.querySelector('.ew-food-card')||!!state&&!state.textContent.includes('正在准备');});
  await Promise.all(pending);
  const errorShown=await page.getByText('未捕获异常',{exact:true}).count();
  if(!calls.length||errors.length||blocked.length)throw new Error(JSON.stringify({calls,errors,blocked}));
  await page.goto(base+'/?demo=1&view=desktop#/');await page.getByRole('button',{name:'换一个',exact:true}).waitFor();
  return{calls,backendHealthy:calls.every(c=>String(c.code)==='0'),backendErrorShown:!!errorShown,mockHome:'passed',pageErrors:errors,blockedWrites:blocked,realBackendWrites:0};
 }finally{await page.goto(base+'/?demo=1&view=desktop#/');await page.evaluate(saved=>saved===null?sessionStorage.removeItem('eatwhat-session'):sessionStorage.setItem('eatwhat-session',saved),saved);await page.unroute(guard);page.off('pageerror',error);page.off('response',response);}
}
