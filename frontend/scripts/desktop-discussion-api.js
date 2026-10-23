async (page) => {
 const base='http://127.0.0.1:5173',calls=[],unexpected=[];
 const previous=await page.evaluate(()=>sessionStorage.getItem('eatwhat-session'));
 const isApi=url=>url.origin===base&&url.pathname.startsWith('/api/');
 await page.route(isApi,async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.slice(4);calls.push({path,method:req.method()});let data=null;
  if(path==='/user/info')data={id:90,userName:'真实适配验收',role:'user',verified:true};
  else if(path==='/notification/unread/count')data=0;
  else if(path==='/foods/detail/44')data={id:44,name:'真实适配菜品',restaurantId:22,restaurantName:'测试餐厅',isLiked:false,isFavorite:false,likesCount:0,pictureUrl:['/prototype/assets/photos/sq_luosi.png']};
  else if(path==='/restaurant/detail/22')data={id:22,name:'测试餐厅',address:'测试地址'};
  else unexpected.push(path);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({code:0,msg:'success',data})});
 });
 try{
  await page.evaluate(()=>sessionStorage.setItem('eatwhat-session',JSON.stringify({tokenName:'x-comment-test',tokenValue:'isolated-qa'})));
  await page.goto(base+'/?demo=0&view=desktop#/comments/write?foodId=44');await page.waitForURL('**#/foods/44?section=comments&compose=1');
  await page.getByRole('heading',{name:'食友讨论即将开放',exact:true}).waitFor();
  if(await page.locator('.food-comment').count())throw new Error('真实模式出现模拟评论');
  if(!await page.getByRole('button',{name:'发表评论',exact:true}).isDisabled()||!await page.getByRole('textbox',{name:'写下你的用餐感受',exact:true}).isDisabled())throw new Error('真实模式开放无接口的提交');
  if(unexpected.length||calls.some(c=>c.method!=='GET'))throw new Error('发起了未约定接口或写入');
  return {checks:['真实模式不展示 Mock 评论','缺少评论接口时只展示开放提示，输入与提交禁用','旧入口指向准确菜品，全部请求拦截'],interceptedRequests:calls.length,commentApiRequests:0,writeRequests:0,realBackendRequests:0};
 }finally{
  await page.goto(base+'/?demo=1&view=desktop#/foods/4');await page.evaluate(value=>value===null?sessionStorage.removeItem('eatwhat-session'):sessionStorage.setItem('eatwhat-session',value),previous);await page.unroute(isApi);
 }
}
