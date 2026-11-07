async (page) => {
  const browser=page.context().browser(),engine=browser.browserType().name();
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await context.newPage(),checks=[],errors=[],requests=[];
  p.setDefaultTimeout(10000);
  p.on('pageerror',e=>errors.push(e.message));
  let profile={displayName:'rpc',avatar:'/prototype/assets/photos/sq_luosi.png',uploadedFoodsCount:31,earnedLikes:0,fansCount:0,followingsCount:0,fansVisible:true,followingsVisible:true,isFollowingHim:false,isFollowingMe:false};
  let mode='content',profileError=false,blocked=false;
  const account={id:10,displayName:'测试食友',verified:true,banned:false,role:'user'};
  const foods=[{id:71,accountId:21,name:'招牌牛筋面',restaurantName:'汤见17码头',price:18.9,category:'staple',stageColor:'soy',pictureUrl:['/prototype/assets/photos/sq_luosi.png'],likesCount:1},{id:72,accountId:21,name:'测试 · 椒润粉',restaurantName:'校园餐厅',price:13,category:'staple',pictureUrl:[],likesCount:0}];
  await context.addInitScript(()=>localStorage.setItem('eatwhat-session',JSON.stringify({tokenName:'x-session',tokenValue:'isolated-profile-layout-test'})));
  await context.route(u=>u.origin!=='http://127.0.0.1:5173',r=>r.abort());
  const reply=(r,data,status=200)=>r.fulfill({status,json:{code:status===200?0:status,data,msg:status===200?'ok':'暂时无法加载'}});
  await context.route(u=>u.pathname.startsWith('/api/'),r=>{
    const u=new URL(r.request().url()),path=u.pathname;
    requests.push({path,query:Object.fromEntries(u.searchParams),method:r.request().method()});
    if(path==='/api/user/info')return reply(r,account);
    if(path==='/api/user/userInfo')return reply(r,profile,profileError?503:200);
    if(path==='/api/user/follow'||path==='/api/user/unfollow') {profile={...profile,isFollowingHim:path.endsWith('/follow')};return reply(r,null)}
    if(path==='/api/user/blocks/21') {
      if(r.request().method()==='PUT')blocked=true;
      if(r.request().method()==='DELETE')blocked=false;
      return reply(r,{userId:21,blocked});
    }
    if(path.startsWith('/api/foods/by-user/')) {
      const currentPage=Number(u.searchParams.get('page')||1),empty=mode==='empty';
      return reply(r,{items:empty?[]:foods.map(f=>({...f,name:currentPage>1?'第二页 '+f.name:f.name})),totalItems:empty?0:31,totalPages:empty?0:3,currentPage,hasNext:!empty&&currentPage<3},mode==='error'?503:200);
    }
    if(path==='/api/campus/list')return reply(r,[{id:1,name:'软件园',open:true,isDefault:true}]);
    if(path==='/api/remote-config')return reply(r,{configVersion:1,flags:{},params:{},maintenance:{mode:'NONE'},announcements:[],versions:{}});
    if(path==='/api/notification/unread/count')return reply(r,0);
    return reply(r,{items:[],totalItems:0,totalPages:0,hasNext:false});
  });
  const base='http://127.0.0.1:5173/?demo=0&view=mobile#/users/21';
  const assert=(ok,message)=>{if(!ok)throw Error(message)};
  const ready=async()=>{
    await p.getByRole('heading',{name:profile.displayName,exact:true}).waitFor();
    await p.getByRole('heading',{name:foods[0].name,exact:true}).waitFor();
    await p.evaluate(()=>document.fonts.ready);
  };
  const layout=async()=>p.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    const root=document.querySelector('.mobile-public-profile'),image=root.querySelector('.mobile-user-food-photo img'),frame=image.parentElement;
    const input=root.querySelector('input[type="search"]');
    return{overflow:document.documentElement.scrollWidth>innerWidth,root:rect(root),grid:rect(root.querySelector('.mobile-user-food-grid')),avatar:rect(root.querySelector('.mobile-user-avatar')),name:rect(root.querySelector('.mobile-user-identity h1')),follow:rect(root.querySelector('.mobile-user-follow')),image:rect(image),frame:rect(frame),inputFont:getComputedStyle(input).fontSize,inputBorder:getComputedStyle(input).borderTopWidth,stage:getComputedStyle(root.querySelector('.mobile-user-stage')).backgroundColor,sheet:rect(root.querySelector('.mobile-user-sheet')),plate:rect(root.querySelector('.mobile-user-plate')),stats:[...root.querySelector('.mobile-user-stats').children].map(rect),buttons:[...root.querySelectorAll('.mobile-user-header a,.mobile-user-header button,.mobile-user-follow,.mobile-user-foods-heading button')].map(rect)};
  });
  const latestList=()=>requests.filter(r=>r.path.startsWith('/api/foods/by-user/')).at(-1);
  try {
    for(const width of [320,360,390,430,520]) {
      await p.setViewportSize({width,height:844});await p.goto(base);await ready();
      const m=await layout();
      assert(!m.overflow&&m.grid.y<480,`${width}: overflow or dishes below the first screen: ${JSON.stringify(m)}`);
      assert(m.avatar.bottom<=m.name.y&&Math.abs(m.avatar.x-m.name.x)<1,`${width}: avatar/name do not match the prototype's vertical composition`);
      assert(m.stage==='rgb(143, 91, 36)'&&m.plate.right>width&&m.sheet.y>=370&&m.sheet.y<=380,`${width}: missing photo-colored stage/oversized plate/overlapping sheet`);
      assert(m.buttons.every(r=>r.height>=44),`${width}: small tap target`);
      assert(m.inputFont==='16px'&&m.inputBorder==='0px','Search has nested borders or tiny text');
      assert(m.stats.every(r=>Math.abs(r.y-m.stats[0].y)<1),'Stats are not aligned');
      assert(Math.abs(m.frame.width/m.frame.height-1.1)<.02&&Math.abs(m.image.width-m.frame.width)<1&&Math.abs(m.image.height-m.frame.height)<1,'Tiles must use full-bleed original photos: '+JSON.stringify(m));
      assert(await p.getByRole('button',{name:'屏蔽这位食友',exact:true}).isVisible()===false,'Block control competes with follow');
      if(width===390||width===320)await p.screenshot({path:`output/playwright/user-profile-${engine}-${width}.png`,fullPage:true});
      checks.push(`${width}px: prototype stage/plate/sheet composition, 44px targets, full-bleed food photos`);
    }
    await p.setViewportSize({width:390,height:844});
    await p.getByRole('button',{name:'关注',exact:true}).click();
    await p.getByRole('button',{name:'已关注',exact:true}).waitFor();
    assert(profile.isFollowingHim,'Follow did not update');
    await p.getByRole('button',{name:'已关注',exact:true}).click();await p.getByRole('button',{name:'关注',exact:true}).waitFor();
    await p.getByRole('button',{name:'更多食友操作',exact:true}).click();
    await p.getByRole('button',{name:'屏蔽这位食友',exact:true}).waitFor();
    await p.keyboard.press('Escape');
    await p.locator('.mobile-user-more').waitFor({state:'hidden'});
    await p.getByRole('button',{name:'更多食友操作',exact:true}).click();
    await p.getByRole('button',{name:'屏蔽这位食友',exact:true}).click();
    await p.locator('.design-notice').waitFor();
    assert(await p.locator('.mobile-user-more').isVisible()===false,'Popover covers confirmation');
    await p.locator('.design-notice').getByRole('button',{name:'取消',exact:true}).click();
    assert(!blocked,'Cancel changed block status');
    checks.push('Follow toggles; more closes on Escape and yields to the existing block confirmation');
    await p.getByRole('link',{name:'0 粉丝',exact:true}).click();
    await p.locator('.profile-people-dialog').waitFor();
    await p.locator('.profile-people-close').click();
    await p.locator('.profile-people-dialog').waitFor({state:'hidden'});
    await p.waitForURL(base);
    assert(p.url()===base,'Closing fans changed profile route');
    checks.push('Fans opens and closes the existing profile people dialog');
    await p.getByRole('button',{name:'下一页',exact:true}).click();
    await p.getByRole('heading',{name:'第二页 '+foods[0].name,exact:true}).waitFor();
    await p.getByRole('button',{name:'搜索和筛选分享',exact:true}).click();
    await p.getByRole('combobox',{name:'分享分类',exact:true}).click();
    await p.getByRole('option',{name:'米面主食',exact:true}).click();
    await p.getByRole('heading',{name:foods[0].name,exact:true}).waitFor();
    assert(latestList().query.category==='staple'&&latestList().query.page==='1','Category did not apply immediately/reset pagination');
    await p.getByRole('searchbox',{name:'搜索食友分享',exact:true}).fill('牛筋面');
    const searchResponse=p.waitForResponse(r=>r.url().includes('/foods/by-user/')&&new URL(r.url()).searchParams.get('keyword')==='牛筋面');
    await p.getByRole('button',{name:'搜索',exact:true}).click();
    await searchResponse;
    await p.getByRole('combobox',{name:'分享排序',exact:true}).click();
    const sortResponse=p.waitForResponse(r=>r.url().includes('/foods/by-user/')&&new URL(r.url()).searchParams.get('sort')==='PRICE_ASC');
    await p.getByRole('option',{name:'价格从低到高',exact:true}).click();
    await sortResponse;
    assert(latestList().query.keyword==='牛筋面'&&latestList().query.category==='staple','Sorting lost search/category');
    checks.push('Search, immediate category/sort and pagination preserve query values');
    profile={...profile,displayName:'认真吃饭的校园食友名字很长也应该完整显示',avatar:'/missing-profile-avatar.png',fansVisible:false,followingsVisible:false};
    foods[0]={...foods[0],name:'加料招牌牛筋牛肉手工拉面超长菜名',restaurantName:'软件园校区万达金街一层很长的餐厅名字'};
    await p.setViewportSize({width:320,height:640});await p.goto(base);await p.reload();await ready();
    await p.waitForFunction(()=>!document.querySelector('.mobile-user-avatar img'));
    assert(!(await layout()).overflow,'Long content overflows');
    assert(await p.locator('.mobile-user-stats a').count()===0,'Private relationships remain linked');
    assert(await p.locator('.mobile-user-avatar').innerText()==='认','Broken avatar did not fall back');
    await p.screenshot({path:`output/playwright/user-profile-${engine}-long.png`,fullPage:true});
    checks.push('Long names, long food/shop titles, missing avatars and private relationships');
    mode='empty';await p.reload();await p.getByRole('heading',{name:'还没有符合条件的分享',exact:true}).waitFor();
    assert(await p.locator('.ew-v2-pages').count()===0,'Empty results show pagination');
    mode='error';await p.reload();await p.getByRole('heading',{name:'暂时没有加载成功',exact:true}).waitFor();
    mode='content';await p.getByRole('button',{name:'重新加载',exact:true}).click();await ready();
    profileError=true;await p.reload();await p.getByRole('heading',{name:'暂时没有加载成功',exact:true}).waitFor();
    profileError=false;await p.getByRole('button',{name:'重新加载',exact:true}).click();await ready();
    checks.push('Empty lists, list error recovery and profile error recovery');
    await p.goto(base.replace('/users/21','/users/10'));await p.getByRole('link',{name:'编辑资料',exact:true}).waitFor();
    assert(await p.getByRole('button',{name:'更多食友操作',exact:true}).count()===0,'Own profile exposes block actions');
    checks.push('Own public profile shows edit instead of follow/block');
    await p.setViewportSize({width:1280,height:900});await p.goto('http://127.0.0.1:5173/?demo=0&view=desktop#/users/21');
    await p.locator('.pc-secondary-user').waitFor();await p.getByRole('button',{name:'筛选',exact:true}).waitFor();
    assert(await p.locator('.mobile-public-profile').count()===0,'Mobile design changed desktop layout');
    checks.push('Desktop retains its existing profile and filter form');
    assert(!errors.length,errors.join('\n'));
    return{engine,checks:checks.length,details:checks,errors};
  }catch(error){await p.screenshot({path:`output/playwright/user-profile-${engine}-failure.png`,fullPage:true});throw Error(JSON.stringify({error:String(error),checks,errors,text:(await p.locator('body').innerText()).slice(0,1600)}))}
  finally{await context.close()}
}
