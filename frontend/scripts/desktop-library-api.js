async (page) => {
 const base='http://127.0.0.1:5173',calls=[],writes=[],checks=[],unexpected=[];
 const previous=await page.evaluate(()=>sessionStorage.getItem('eatwhat-session'));let failure=true,deleted=false,tagName='接口验收标签';
 const isApi=url=>url.origin===base&&url.pathname.startsWith('/api/'),ok=data=>({code:0,msg:'success',data}),now=Date.now();
 await page.route(isApi,async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname.slice(4),pageNo=Number(url.searchParams.get('page')||1);calls.push({path,method:req.method(),page:pageNo});let status=200,result=ok(null);
  if(path==='/user/info')result=ok({id:90,userName:'验收食友',verified:true,role:'user'});
  else if(path==='/notification/unread/count')result=ok(0);
  else if(path==='/user/userInfo')result=ok({userName:'验收食友',uploadedFoodsCount:2});
  else if(path==='/foods/tags/my')result=ok({items:pageNo===1?[{id:8,name:'第一页标签',usageCount:2}]:deleted?[]:[{id:9,name:tagName,usageCount:1}],totalItems:deleted?1:2,currentPage:pageNo,totalPages:deleted?1:2,hasNext:pageNo===1&&!deleted});
  else if(path==='/foods/tags/my/9'){writes.push({path,method:req.method(),body:req.postData()});if(req.method()==='PUT'){if(failure){status=400;result={code:900,msg:'验收：名称暂未保存',data:null}}else tagName=req.postDataJSON().name}else if(req.method()==='DELETE')deleted=true}
  else if(path==='/history/browse'){
   const kind=url.searchParams.get('targetType');if(!['food','restaurant'].includes(kind)||url.searchParams.get('pageSize')!=='12')unexpected.push('invalid history params');
   const items=kind==='restaurant'?[{targetType:'restaurant',targetId:71,viewedAt:now,restaurant:{id:71,name:'验收面馆',pictureUrl:['/prototype/assets/photos/sq_luosi.png']}}]:pageNo===1?[{targetType:'food',targetId:71,viewedAt:Math.floor(now/1000),food:{id:71,name:'验收菜品',pictureUrl:['/prototype/assets/photos/sq_luosi.png']}},{targetType:'food',targetId:72,viewedAt:null,food:null}]:[{targetType:'food',targetId:73,viewedAt:now-86400000,food:{id:73,name:'昨日菜品'}}];
   result=ok({items,currentPage:pageNo,totalItems:kind==='food'?3:1,totalPages:kind==='food'?2:1,hasNext:kind==='food'&&pageNo===1});
  }else{unexpected.push(path);status=404;result={code:404,msg:'未配置：'+path,data:null}}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
 try{
  await page.evaluate(()=>sessionStorage.setItem('eatwhat-session',JSON.stringify({tokenName:'x-library-test',tokenValue:'isolated-qa'})));await page.goto(base+'/?demo=0&view=desktop#/me/tags');await page.getByRole('heading',{name:'第一页标签',exact:true}).waitFor();await page.getByRole('button',{name:'下一页',exact:true}).click();await page.getByRole('button',{name:'重命名接口验收标签',exact:true}).click();await page.getByRole('textbox',{name:/标签名称/}).fill(' 重试后的标签 ');await page.getByRole('button',{name:'保存名称',exact:true}).click();await page.getByText('验收：名称暂未保存',{exact:true}).waitFor();if(await page.getByRole('textbox',{name:/标签名称/}).inputValue()!==' 重试后的标签 ')throw new Error('失败丢失标签名');
  failure=false;await page.getByRole('button',{name:'保存名称',exact:true}).click();await page.getByRole('heading',{name:'重试后的标签',exact:true}).waitFor();await page.getByRole('button',{name:'删除重试后的标签',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'删除标签',exact:true}).click();await page.getByRole('heading',{name:'第一页标签',exact:true}).waitFor();checks.push('标签分页、PUT 错误保留输入、修正重试、DELETE 后空尾页回到上一页');
  await page.goto(base+'/?demo=0&view=desktop#/history');await page.locator('a.pc-history-entry').filter({hasText:'验收菜品'}).waitFor();if(await page.locator('a.pc-history-entry').filter({hasText:'验收菜品'}).getAttribute('href')!=='#/foods/71')throw new Error('菜品路由错误');if(await page.locator('.pc-history-entry.is-unavailable').count()!==1)throw new Error('已失效记录未禁用');await page.getByRole('button',{name:'下一页',exact:true}).click();await page.getByText('昨日菜品',{exact:true}).waitFor();await page.getByRole('tab',{name:'浏览的店铺',exact:true}).click();const shop=page.locator('a.pc-history-entry').filter({hasText:'验收面馆'});await shop.waitFor();if(await shop.getAttribute('href')!=='#/restaurants/71')throw new Error('相同 ID 的店铺被当成菜品');
  if(calls.filter(c=>c.path==='/history/browse').at(-1).page!==1)throw new Error('切换类型没有重置页码');checks.push('足迹分页、秒/毫秒时间、失效内容禁用、同 ID 不同对象正确链接、切换分类重置页码');
  if(unexpected.length||writes.length!==3)throw new Error('未约定接口或重复写入 '+unexpected.join(','));return {checks,interceptedRequests:calls.length,tagWrites:writes.length,uncontractedRequests:unexpected,realBackendRequests:0};
 }finally{await page.goto(base+'/?demo=1&view=desktop#/me/tags');await page.evaluate(value=>value===null?sessionStorage.removeItem('eatwhat-session'):sessionStorage.setItem('eatwhat-session',value),previous);await page.unroute(isApi)}
}
