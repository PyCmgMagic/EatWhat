async(page)=>{
 const base='http://127.0.0.1:5173',checks=[],calls=[],writes=[],puts=[],unexpected=[],errors=[];
 const saved=await page.evaluate(()=>({session:sessionStorage.getItem('eatwhat-session'),demo:sessionStorage.getItem('eatwhat-demo-session'),area:localStorage.getItem('eatwhat-area'),campus:localStorage.getItem('eatwhat-campus')}));
 const id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0'),ok=data=>({code:0,msg:'ok',data});
 const me={id:90,userName:'扩展接口验收',verified:false,role:'admin',hasPassword:true};
 let withdrawalFail=true,catalogConflict=true,objectBlocked=true,reviewUnavailable=true,failSecondPut=true;
 const hub={id:1,name:'验收区域',gcjLng:117.134,gcjLat:36.667,campusId:1},food={id:71,accountId:90,name:'验收面',restaurantId:1,restaurantName:'验收面馆',category:'staple',price:12,pictureUrl:['/prototype/assets/photos/sq_luosi.png'],pictureKeys:['foods/existing'],stageColor:'broth'};
 const catalog=[{conflictId:id(1),kind:'HUB',naturalKey:'验收目录冲突',revision:8,status:'OPEN',candidates:[{gid:id(10),revision:3,contentHash:'left',numericId:1,sourceSite:'CAMPUS'},{gid:id(11),revision:4,contentHash:'right',numericId:2,sourceSite:'EXTERNAL'}]}];
 const objects=[{conflictId:id(2),objectGid:id(20),revision:5,numericId:1,status:'OPEN',heads:[{operationId:id(21),revision:1,contentHash:'head-a'},{operationId:id(22),revision:2,contentHash:'head-b'}]}];
 const decisions=[{conflictId:id(3),kind:'FOOD',status:'OPEN',candidateOperations:[id(31),id(32)],decisionHeads:[id(33)]}];
 const profile={conflictId:id(4),revision:6,subjectId:id(40),fieldGroup:'个人资料',heads:[{gid:id(41),revision:1,contentHash:'profile-a'},{gid:id(42),revision:2,contentHash:'profile-b'}]};
 const profiles=[profile],profileReviews=[{eventId:id(6),reason:'核对资料授权',conflict:{...profile,conflictId:id(7)}}];
 const guard=u=>u.origin===base&&u.pathname.startsWith('/api/'),err=e=>errors.push(e.message);page.on('pageerror',err);
 await page.route(guard,async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname.slice(4),method=req.method(),body=req.postData()?req.postDataJSON():undefined;
  calls.push({path,method,query:Object.fromEntries(url.searchParams)});if(method!=='GET')writes.push({path,method,body,headers:req.headers()});let data=null,status=200,code=0,msg='ok';
  if(path==='/campus/list')data=[{id:1,name:'验收校区',open:true,isDefault:true}];
  else if(path==='/user/info')data=me;
  else if(path==='/notification/unread/count')data=0;
  else if(path==='/auth/verify')data=['verify:school_email'];
  else if(path==='/auth/consent/withdraw-with-password'){if(withdrawalFail){status=401;code=400;msg='验收：密码不正确';}else data={status:'WITHDRAWN',cleanupStatus:'PENDING',epoch:1,revision:3,identityReady:false,registrationAccepted:true};}
  else if(path==='/admin/summary')data={totalUsers:1,totalFoods:1,totalRestaurants:1};
  else if(path==='/foods/list'||path==='/foods/my'||path==='/foods/favorites')data={items:[food],hasNext:false};
  else if(path==='/foods/recommend')data=[food];
  else if(path.startsWith('/foods/detail/'))data=food;
  else if(path==='/foods/tags/system')data=[];
  else if(path==='/foods/tags/my')data={items:[],hasNext:false};
  else if(/^\/foods\/\d+\/tags$/.test(path))data={systemTags:[],myCustomTags:[]};
  else if(path==='/hub/list')data={items:[hub],hasNext:false};
  else if(path==='/hub/detail/1'||path==='/hub/locate')data=hub;
  else if(path==='/restaurant/browse'||path==='/restaurant/search')data={items:[{id:1,name:'验收面馆',address:'软件园校区',gcjLng:117.134,gcjLat:36.667}],hasNext:false};
  else if(path==='/restaurant/detail/1')data={id:1,name:'验收面馆',address:'软件园校区',gcjLng:117.134,gcjLat:36.667};
  else if(path==='/admin/sync/catalog/conflicts')data=catalog.filter(row=>row.status==='OPEN');
  else if(path==='/admin/sync/catalog/conflicts/objects')data=objects.filter(row=>row.status==='OPEN');
  else if(path==='/admin/sync/catalog/conflicts/decisions')data=decisions;
  else if(path==='/admin/sync/catalog/conflicts/decisions/'+id(3))data=decisions[0];
  else if(path==='/admin/sync/catalog/conflicts/reviews'){if(reviewUnavailable){status=404;code=404;msg='not found';}else data=[{eventId:id(5),conflictId:id(1),reason:'授权范围复核'}];}
  else if(path==='/admin/sync/catalog/conflicts/'+id(1)+'/resolve'){data={status:catalogConflict?'CONFLICT':'APPLIED',revision:9};if(!catalogConflict)catalog[0].status='RESOLVED';else catalog[0].revision=9;}
  else if(path==='/admin/sync/catalog/conflicts/objects/'+id(2)+'/resolve'){data={status:objectBlocked?'BLOCKED':'APPLIED',revision:6};if(!objectBlocked)objects[0].status='RESOLVED';}
  else if(path==='/admin/sync/catalog/conflicts/decisions/'+id(3)+'/resolve')data={status:'APPLIED',revision:2};
  else if(path==='/admin/sync/profile-conflicts')data=profiles;
  else if(path==='/admin/sync/profile-conflicts/authorization-reviews')data=profileReviews;
  else if(path==='/admin/sync/profile-conflicts/'+id(4)+'/resolve'){profiles.splice(0);}
  else if(path==='/admin/sync/profile-conflicts/authorization-reviews/'+id(6)+'/resolve'){profileReviews.splice(0);}
  else if(path==='/admin/sync/catalog/import/hubs')data={batchId:id(100),status:'REPLAYED',created:1,updated:0};
  else if(path==='/upload/presign/batch')data={files:[{key:'foods/qa-a.jpg',putUrl:'https://storage.invalid/remaining-a'},{key:'foods/qa-b.jpg',putUrl:'https://storage.invalid/remaining-b'}]};
  else if(path==='/upload/presign')data={key:'foods/qa-b.jpg',putUrl:'https://storage.invalid/remaining-b'};
  else if(path==='/upload/complete')data={key:body.key,revision:1,size:100};
  else if(path==='/foods/upload'){Object.assign(food,body,{id:76,pictureKeys:body.pictureUrl,pictureUrl:['/prototype/assets/photos/sq_luosi.png']});data={id:76};}
  else {unexpected.push(method+' '+path);status=404;code=404;msg='未配置 '+path;}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify({code,msg,data})});
 });
 await page.route('https://storage.invalid/remaining-*',async route=>{const req=route.request();puts.push({url:req.url(),headers:req.headers()});const failing=req.url().endsWith('-b')&&failSecondPut;if(failing)failSecondPut=false;await route.fulfill({status:failing?503:200,headers:{'access-control-allow-origin':base},body:''});});
 const go=async(path,view='desktop')=>{await page.goto(base+'/?demo=0&view='+view+'#'+path);await page.reload();};
 const selectTab=name=>page.getByRole('navigation',{name:'同步管理分类'}).getByRole('button',{name,exact:true}).click();
 const editor=()=>page.locator('.sync-editor');
 const prepare=async(choice='REJECT')=>{await editor().getByLabel('处理方式',{exact:true}).selectOption(choice);if(choice==='KEEP')await editor().getByLabel('保留的候选版本',{exact:true}).selectOption({index:1});await editor().getByLabel('处理原因',{exact:true}).fill('验收：已经核对两站版本');await editor().getByRole('checkbox').check();};
 const submit=()=>editor().getByRole('button',{name:'提交本次处理',exact:true}).click();
 try{
  await page.evaluate(()=>{sessionStorage.setItem('eatwhat-session',JSON.stringify({tokenName:'x-remaining',tokenValue:'isolated-test'}));localStorage.removeItem('eatwhat-area');});
  await page.setViewportSize({width:1440,height:1000});await go('/admin');await page.getByRole('button',{name:'菜品维护',exact:true}).click();await page.getByRole('cell',{name:'验收面',exact:true}).waitFor();if(calls.filter(call=>call.path==='/foods/list').at(-1).query.restaurantId)throw new Error('管理全站查询仍要求餐厅');checks.push('未认证管理员读取全站菜品，保留管理员写权限');
  await page.getByRole('button',{name:'跨站同步',exact:true}).click();await page.locator('.sync-record').first().click();await prepare('KEEP');await page.locator('.sync-workbench').screenshot({path:'output/playwright/remaining-sync-desktop.png'});await submit();await page.getByRole('alert').filter({hasText:'版本已变化'}).waitFor();if(!await page.locator('.sync-record').count())throw new Error('CONFLICT 被当成功');catalogConflict=false;if(await editor().getByRole('button',{name:'提交本次处理',exact:true}).isEnabled())throw new Error('旧版本仍可直接重试');await editor().getByRole('button',{name:'重新读取',exact:true}).click();await prepare('KEEP');await submit();await editor().waitFor({state:'detached'});let write=writes.find(write=>write.path==='/admin/sync/catalog/conflicts/'+id(1)+'/resolve');if(write.body.expectedRevision!==8||write.body.candidates.length!==2||write.body.winnerGid!==id(10))throw new Error('目录快照丢失');checks.push('目录冲突携带完整快照，HTTP 成功的 CONFLICT 不伪报应用');
  await selectTab('对象版本');await page.locator('.sync-record').first().click();await prepare();await submit();await page.getByRole('alert').filter({hasText:'处理被阻止'}).waitFor();objectBlocked=false;await submit();await editor().waitFor({state:'detached'});write=writes.find(write=>write.path.includes('/objects/')&&write.path.endsWith('/resolve'));if(write.body.expectedRevision!==5||write.body.heads.length!==2)throw new Error('对象快照不完整');checks.push('对象版本携带 heads，BLOCKED 明确反馈并可恢复');
  await selectTab('目录决策');await page.locator('.sync-record').first().click();await prepare('KEEP');await submit();await editor().waitFor({state:'detached'});write=writes.find(write=>write.path.includes('/decisions/')&&write.path.endsWith('/resolve'));if(write.body.decisionHeads[0]!==id(33)||write.body.candidateOperations.length!==2)throw new Error('决策快照不完整');checks.push('目录决策先读取详情，再提交候选操作与决策 heads');
  await selectTab('目录授权复核');await page.getByRole('alert').filter({hasText:'当前站点暂未开放'}).waitFor();reviewUnavailable=false;await page.getByRole('button',{name:'重新加载',exact:true}).click();await page.locator('.sync-record').first().click();await page.getByText('此列表用于核对授权原因；',{exact:false}).waitFor();checks.push('条件接口 404 显示未开放，可重试恢复，目录复核只读');
  for(const name of ['资料冲突','资料授权复核']){await selectTab(name);await page.locator('.sync-record').first().click();await prepare('KEEP');await submit();await editor().waitFor({state:'detached'});}checks.push('资料冲突与授权复核使用返回修订号和明确候选版本提交');
  await selectTab('导入区域');const importBody={sourceKey:'qa-source',requestId:id(100),contentHash:'qa-supplied-hash',hubs:[{sourceId:'qa-hub',name:'验收导入区域',centerGcj:{lng:117.13,lat:36.66},rebindCoveredRestaurants:false}]};await page.getByLabel('目录文件内容',{exact:true}).fill(JSON.stringify(importBody));await page.getByRole('button',{name:'预览导入内容',exact:true}).click();if(await page.getByRole('button',{name:'确认导入区域',exact:true}).isEnabled())throw new Error('导入无需核对');await page.getByRole('checkbox',{name:'已核对这 1 个区域及餐厅归属影响。',exact:true}).check();await page.getByRole('button',{name:'确认导入区域',exact:true}).dblclick();await page.getByText('该批次已处理，返回既有结果',{exact:true}).waitFor();const imports=writes.filter(write=>write.path==='/admin/sync/catalog/import/hubs');if(imports.length!==1||JSON.stringify(imports[0].body)!==JSON.stringify(importBody))throw new Error('导入身份变化或重复');checks.push('目录导入先预览核对，保留批次与摘要，REPLAYED 正确显示');
  me.verified=true;await go('/verify');await page.getByText('学校邮箱认证',{exact:true}).waitFor();checks.push('认证页读取实际认证方式');
  await go('/auth/withdraw-consent');await page.getByLabel('用户名',{exact:true}).fill('qa_student');await page.getByLabel('登录密码',{exact:true}).fill('qa-password');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'验证身份并撤回授权',exact:true}).click();await page.getByRole('alert').filter({hasText:'密码不正确'}).waitFor();if(!await page.evaluate(()=>sessionStorage.getItem('eatwhat-session')))throw new Error('公开撤回失败清除了其他会话');withdrawalFail=false;await page.getByRole('button',{name:'验证身份并撤回授权',exact:true}).click();await page.getByRole('heading',{name:'撤回请求已提交',exact:true}).waitFor();await page.getByText('PENDING',{exact:true}).waitFor();if(writes.filter(write=>write.path==='/auth/consent/withdraw-with-password').some(write=>write.headers['x-remaining']))throw new Error('公开撤回带了旧会话');checks.push('密码撤回不要求政策同意、不携带旧会话，401 保留其他会话，展示实际清理进度');
  await go('/search');await page.getByRole('button',{name:'选择区域',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/验收区域/}).click();await page.getByRole('dialog').waitFor({state:'detached'});if(!calls.some(call=>call.path==='/hub/detail/1'))throw new Error('没有读取区域详情');
  await page.context().grantPermissions(['geolocation']);await page.context().setGeolocation({longitude:117.134,latitude:36.667});await page.getByRole('button',{name:'验收区域',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'使用我的位置',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});if(!calls.some(call=>call.path==='/hub/locate'))throw new Error('定位没有识别 Hub');checks.push('选区读取详情，设备定位转为 GCJ02 后识别所属区域');
  await go('/publish');await page.getByRole('radio',{name:/验收面馆/}).click();await page.getByRole('textbox',{name:'菜名',exact:true}).fill('批量上传验收菜');await page.locator('input[type=file]').setInputFiles(['prototype/assets/photos/sq_luosi.png','prototype/assets/photos/sq_paigu.png']);await page.getByRole('button',{name:'发布这道菜',exact:true}).click();await page.getByText('第 2 张图片上传失败（HTTP 503），请重试。',{exact:true}).waitFor();if(writes.some(write=>write.path==='/foods/upload'))throw new Error('上传失败仍发布');await page.getByRole('button',{name:'发布这道菜',exact:true}).click();await page.waitForURL(/#\/foods\/76$/);const upload=writes.find(write=>write.path==='/foods/upload');if(upload.body.pictureUrl.join('|')!=='foods/qa-a.jpg|foods/qa-b.jpg'||writes.filter(write=>write.path==='/upload/presign/batch').length!==1||puts.filter(put=>put.url.endsWith('-a')).length!==1||puts.some(put=>put.headers['x-remaining']||put.headers.authorization))throw new Error('批量上传重试重复或泄露会话');checks.push('多图使用批量签名，第二张失败保留第一张，重试仅上传未完成照片');
  for(const view of ['desktop','mobile'])for(const width of view==='desktop'?[1024,1280,1440,1920]:[360,390,430]){await page.setViewportSize({width,height:900});await go('/auth/withdraw-consent',view);await page.getByRole('heading',{name:'使用密码撤回同步授权',exact:true}).waitFor();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('撤回页溢出 '+width);await go('/admin',view);await page.getByRole('button',{name:'跨站同步',exact:true}).click();await selectTab('目录决策');await page.locator('.sync-record').first().click();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('同步页溢出 '+width);if(width===390)await page.locator('.sync-workbench').screenshot({path:'output/playwright/remaining-sync-mobile.png'});}
  checks.push('4 种 PC、3 种手机宽度的撤回和同步页面无横向溢出');
  if(unexpected.length||errors.length)throw new Error(JSON.stringify({unexpected,errors}));return{checks,interceptedRequests:calls.length,interceptedWrites:writes.length,storagePuts:puts.length,pageErrors:errors,realBackendRequests:0};
 }catch(cause){await page.screenshot({path:'output/playwright/remaining-failure.png'});throw cause;}finally{await page.context().clearPermissions();await page.context().setGeolocation(null);await page.goto(base+'/?demo=1&view=desktop#/');await page.evaluate(saved=>{for(const[key,value]of[['eatwhat-session',saved.session],['eatwhat-demo-session',saved.demo]])value===null?sessionStorage.removeItem(key):sessionStorage.setItem(key,value);for(const[key,value]of[['eatwhat-area',saved.area],['eatwhat-campus',saved.campus]])value===null?localStorage.removeItem(key):localStorage.setItem(key,value);},saved);await page.setViewportSize({width:1440,height:1000});await page.unroute(guard);await page.unroute('https://storage.invalid/remaining-*');page.off('pageerror',err);}
}
