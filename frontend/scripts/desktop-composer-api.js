async(page)=>{
 const base='http://127.0.0.1:5173',checks=[],posts=[],calls=[],puts=[];let failure='uncertain';
 const ok=data=>({code:0,msg:'success',data}),empty={items:[],currentPage:1,totalItems:0,totalPages:0,hasNext:false},shop={id:44,name:'验收餐厅',address:'软件园校区',gcjLng:117.134,gcjLat:36.667};
 const isApi=url=>url.origin===base&&url.pathname.startsWith('/api/');
 const previous=await page.evaluate(()=>({session:sessionStorage.getItem('eatwhat-session'),area:localStorage.getItem('eatwhat-area')}));
 await page.route(isApi,async route=>{const req=route.request(),path=new URL(req.url()).pathname.slice(4);calls.push(path);let status=200,result=ok(null);
  if(path==='/user/info')result=ok({id:90,userName:'验收食友',verified:true,role:'user'});
  else if(path==='/notification/unread/count')result=ok(0);
  else if(path==='/restaurant/search')result=ok({...empty,items:[shop],totalItems:1});
  else if(path==='/restaurant/detail/44')result=ok(shop);
  else if(path==='/upload/presign')result=ok({key:'foods/composer-test.png',putUrl:'https://storage.invalid/composer-test.png'});
  else if(path==='/upload/complete')result=ok({key:'foods/composer-test.png'});
  else if(path==='/foods/upload'){posts.push(req.postDataJSON());if(failure==='uncertain'){status=503;result={code:503,msg:'验收：结果待核实',data:null}}else if(failure==='business'){status=400;result={code:900,msg:'验收：菜名需要修改',data:null}}}
  else if(path==='/foods/my')result=ok(empty);
  else if(path==='/user/userInfo')result=ok({id:90,userName:'验收食友',uploadedFoodsCount:0});
  else result={code:404,msg:'验收未配置：'+path,data:null};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.route('https://storage.invalid/composer-test.png',async route=>{if(route.request().method()==='PUT')puts.push(route.request().headers());await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'PUT,OPTIONS','access-control-allow-headers':'content-type'},body:''})});
 try{
  await page.evaluate(()=>{sessionStorage.setItem('eatwhat-session',JSON.stringify({tokenName:'x-composer-test',tokenValue:'qa-session'}));localStorage.setItem('eatwhat-area',JSON.stringify({name:'软件园校区',gcjLng:117.134,gcjLat:36.667,hubId:1,source:'hub'}))});
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/?demo=0&view=desktop#/publish');await page.reload();
  await page.getByRole('radio',{name:/验收餐厅/}).click();await page.getByRole('textbox',{name:'菜名',exact:true}).fill('接口验收菜');await page.getByRole('spinbutton',{name:'价格',exact:true}).fill('0');await page.locator('input[type=file]').setInputFiles('prototype/assets/photos/sq_luosi.png');
  await page.getByRole('button',{name:'发布这道菜',exact:true}).waitFor();await page.getByRole('button',{name:'发布这道菜',exact:true}).dblclick();
  await page.getByText('发布结果尚未确认，请先核实，避免重复分享。',{exact:true}).waitFor();
  if(posts.length!==1||!await page.getByRole('button',{name:'发布这道菜',exact:true}).isDisabled())throw new Error('未知结果自动重试或未锁定');
  if(puts.length!==1||puts[0]['x-composer-test']||puts[0].authorization)throw new Error('上传重复或泄露应用请求头');
  if(posts[0].restaurantId!==44||posts[0].price!==0||posts[0].pictureUrl[0]!=='foods/composer-test.png')throw new Error('创建请求体错误');
  checks.push('真实适配层三段上传、PUT 隔离、零元价格、准确餐厅和存储 key');
  await page.getByRole('link',{name:'查看我的分享',exact:true}).click();await page.waitForURL('**#/me?tab=uploads');await page.getByRole('link',{name:'发布一道菜',exact:true}).click();
  await page.getByText('发布结果尚未确认，请先核实，避免重复分享。',{exact:true}).waitFor();if(!await page.getByRole('button',{name:'发布这道菜',exact:true}).isDisabled())throw new Error('返回页面丢失未知结果锁定');
  await page.getByRole('checkbox',{name:'已确认这道菜尚未发布',exact:true}).check();await page.getByRole('button',{name:'继续编辑',exact:true}).click();
  failure='business';await page.getByRole('button',{name:'发布这道菜',exact:true}).click();await page.getByText('验收：菜名需要修改',{exact:true}).waitFor();if(await page.getByRole('textbox',{name:'菜名',exact:true}).inputValue()!=='接口验收菜')throw new Error('业务失败丢失草稿');
  failure='success';await page.getByRole('textbox',{name:'菜名',exact:true}).fill('接口验收菜修改');await page.getByRole('button',{name:'发布这道菜',exact:true}).click();await page.waitForURL('**#/me?tab=uploads');
  if(posts.length!==3||puts.length!==1)throw new Error('恢复与重试重复上传或创建次数错误');checks.push('未知结果跨导航锁定、人工核实恢复、业务错误保留草稿、重试复用已上传照片、Void 成功不猜 ID');
  return {checks,createRequests:posts.length,storagePuts:puts.length,interceptedRequests:calls.length,realBackendRequests:0};
 }finally{
  await page.goto(base+'/?demo=1&view=desktop#/publish');
  await page.evaluate(value=>{if(value.session===null)sessionStorage.removeItem('eatwhat-session');else sessionStorage.setItem('eatwhat-session',value.session);if(value.area===null)localStorage.removeItem('eatwhat-area');else localStorage.setItem('eatwhat-area',value.area)},previous);
  await page.unroute(isApi);await page.unroute('https://storage.invalid/composer-test.png');
 }
}
