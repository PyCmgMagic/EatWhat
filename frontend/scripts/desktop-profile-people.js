async(page)=>{
 const base='http://127.0.0.1:5173',checks=[],errors=[],calls=[],unexpected=[];
 const fail=e=>errors.push(e.message),guard=u=>u.origin===base&&u.pathname.startsWith('/api/');page.on('pageerror',fail);
 const settle=()=>page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))});
 const panel=()=>page.locator('.profile-people-dialog'),close=async()=>{await page.getByRole('button',{name:'关闭关注与粉丝',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.profile-people-dialog').open);await settle()};
 const saved=await page.evaluate(()=>({session:localStorage.getItem('eatwhat-session')}));
 let privacy={fans:false,follow:true},failure=false,banned=false;
 await page.route(guard,async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname.slice(4),id=Number(url.searchParams.get('userId')||90),p=Number(url.searchParams.get('page')||1);calls.push({path,id,page:p,method:req.method()});let data=null,status=200,msg='ok';
  if(path==='/user/info')data={id:90,userName:'认真吃饭的同学',verified:true,role:'user',avatar:null,banned};
  else if(path==='/campus/list')data=[{id:1,name:'软件园校区',open:true}];
  else if(path==='/notification/unread/count')data=0;
  else if(path==='/user/userInfo')data={userName:id===90?'认真吃饭的同学':'阿圆不想早八',fansVisible:id===90?true:privacy.fans,followingsVisible:id===90?true:privacy.follow,fansCount:3,followingsCount:24,earnedLikes:96,uploadedFoodsCount:0,isFollowingHim:false};
  else if(path==='/foods/my'||path==='/foods/favorites')data={items:[],currentPage:1,hasNext:false,totalItems:0};
  else if(path==='/user/followings'||path==='/user/followers'){
   if(failure){status=403;msg='验收：列表暂时不可读取'}
   else data={items:path.endsWith('followers')?[{id:21,userName:'阿圆不想早八'},{id:22,userName:'小林爱吃面'},{userName:'资料待补充'}]:p===1?Array.from({length:20},(_,i)=>({id:21+i,userName:i===0?'阿圆不想早八':`校园食友${i+1}`})):Array.from({length:4},(_,i)=>({id:51+i,userName:`第二页食友${i+1}`})),currentPage:p,hasNext:path.endsWith('followings')&&p===1,totalItems:path.endsWith('followers')?3:24};
  }else if(path==='/foods/tags/my')data={items:[],hasNext:false};
  else{unexpected.push(path);status=404;msg='未配置 '+path}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify({code:status===200?0:status,msg,data})});
 });
 try{
  await page.setViewportSize({width:1440,height:900});await page.goto(base+'/?demo=1&view=desktop#/me');await page.getByRole('link',{name:'查看我的粉丝',exact:true}).waitFor();
  const background=await page.locator('.pc-profile-content').elementHandle();await page.getByRole('tab',{name:/收藏/}).click();await settle();
  await page.getByRole('link',{name:'查看我的粉丝',exact:true}).click();await page.getByRole('dialog',{name:'关注与粉丝',exact:true}).waitFor();await panel().getByRole('link',{name:'查看阿圆不想早八的主页',exact:true}).waitFor();
  if(!page.url().includes('#/me?people=fans')||await page.locator('.pc-secondary-follows').count())throw new Error('仍然进入独立关注页');
  await close();if(!await background.evaluate(e=>e.isConnected)||await page.getByRole('tab',{name:/收藏/}).getAttribute('aria-selected')!=='true')throw new Error('打开列表丢失主页内容');
  if(!await page.getByRole('link',{name:'查看我的粉丝',exact:true}).evaluate(e=>document.activeElement===e))throw new Error('关闭未恢复入口焦点');
  checks.push('我的主页内打开、背景节点与收藏标签保留、关闭恢复焦点');
  await page.goto(base+'/?demo=1&view=desktop#/follows?tab=fans');await page.waitForURL(/#\/me\?people=fans$/);await panel().waitFor();await page.keyboard.press('Escape');await page.waitForURL(/#\/me$/);await settle();
  await page.getByRole('link',{name:'查看我的关注',exact:true}).click();await panel().waitFor();await page.goBack();await page.waitForFunction(()=>!document.querySelector('.profile-people-dialog').open);await page.goForward();await panel().waitFor();await close();
  checks.push('旧链接回到主页弹层、直接进入可关闭、浏览器后退关闭与前进重开');

  await page.evaluate(()=>localStorage.setItem('eatwhat-session',JSON.stringify({tokenName:'x-people-test',tokenValue:'isolated-test'})));
  await page.goto(base+'/?demo=0&view=desktop#/me');await page.reload();await page.getByRole('link',{name:'查看我的关注',exact:true}).click();await panel().getByRole('link',{name:'查看阿圆不想早八的主页',exact:true}).waitFor();
  if(calls.filter(c=>c.path==='/user/followings').at(-1).id!==90)throw new Error('未使用当前用户 ID');
  const before=calls.filter(c=>c.path.startsWith('/user/follow')).length;await panel().getByRole('textbox',{name:'搜索本页食友'}).fill('不存在');await panel().getByRole('heading',{name:'本页没有找到这位食友'}).waitFor();await panel().getByRole('button',{name:'清除搜索',exact:true}).click();
  if(calls.filter(c=>c.path.startsWith('/user/follow')).length!==before)throw new Error('本页搜索误发全站查询');
  await panel().getByRole('button',{name:'下一页食友'}).click();await panel().getByRole('link',{name:'查看第二页食友1的主页'}).waitFor();if(calls.filter(c=>c.path==='/user/followings').at(-1).page!==2)throw new Error('分页未调用实际页码');
  await panel().getByRole('tab',{name:/^粉丝/}).click();await panel().getByRole('link',{name:'查看小林爱吃面的主页'}).waitFor();
  if(page.url().includes('peoplePage')||calls.filter(c=>c.path==='/user/followers').at(-1).page!==1)throw new Error('切换类型没有重置页码');
  if(await panel().locator('.unavailable a').count())throw new Error('无效用户仍可跳转');
  await page.screenshot({path:'output/playwright/profile-people-desktop.png'});
  checks.push('真实适配层读取、分页、类型切换复位、本页搜索、无效编号保护');

  await panel().getByRole('link',{name:'查看阿圆不想早八的主页'}).click();await page.waitForURL(/#\/users\/21$/);await page.getByRole('heading',{name:'阿圆不想早八',exact:true}).waitFor();await page.goBack();await panel().getByRole('link',{name:'查看小林爱吃面的主页'}).waitFor();
  if(await panel().getByRole('tab',{name:/^粉丝/}).getAttribute('aria-selected')!=='true')throw new Error('查看食友后返回丢失原列表');await close();
  checks.push('查看食友主页后，浏览器返回恢复原类型与列表');

  const prior=calls.filter(c=>c.path==='/user/followers').length;
  await page.goto(base+'/?demo=0&view=desktop#/follows?tab=fans&userId=21');await page.waitForURL(/#\/users\/21\?people=fans$/);await panel().getByRole('heading',{name:'对方没有公开这个列表'}).waitFor();
  if(calls.filter(c=>c.path==='/user/followers').length!==prior)throw new Error('未公开粉丝仍发请求');
  await panel().getByRole('tab',{name:/^关注/}).click();await panel().getByRole('link',{name:'查看阿圆不想早八的主页'}).waitFor();
  if(calls.filter(c=>c.path==='/user/followings').at(-1).id!==21)throw new Error('他人列表传错 ID');await close();
  privacy.follow=undefined;await page.goto(base+'/?demo=0&view=desktop#/users/21?people=follow');await page.reload();const priorUnknown=calls.filter(c=>c.path==='/user/followings').length;await panel().getByRole('heading',{name:'暂时无法确认公开范围'}).waitFor();if(calls.filter(c=>c.path==='/user/followings').length!==priorUnknown)throw new Error('未知可见性仍读取列表');
  checks.push('他人列表留在其主页、隐私关闭和未知时均不读取');

  privacy.follow=true;failure=true;await page.goto(base+'/?demo=0&view=desktop#/me?people=follow');await page.reload();await panel().getByText('验收：列表暂时不可读取',{exact:true}).waitFor();failure=false;await panel().getByRole('button',{name:'重新加载'}).click();await panel().getByRole('link',{name:'查看阿圆不想早八的主页'}).waitFor();checks.push('列表失败有重试，403 保留会话');

  let responsive=0;
  for(const width of [320,375,390,430,768,1024,1440,1920]){
   await page.setViewportSize({width,height:844});const view=width<1024?'mobile':'desktop';await page.goto(base+'/?demo=0&view='+view+'#/me?people=fans');await panel().getByRole('link',{name:'查看小林爱吃面的主页'}).waitFor();await settle();
   const geometry=await panel().evaluate(e=>({box:e.getBoundingClientRect().toJSON(),scroll:e.scrollWidth,client:e.clientWidth}));
   if(geometry.box.left<-.5||geometry.box.right>width+.5||geometry.box.bottom>844.5||geometry.scroll>geometry.client+1||await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('食友弹层溢出 '+width+' '+JSON.stringify(geometry));responsive++;
   if(width===390)await page.screenshot({path:'output/playwright/profile-people-mobile.png'});
   await close();await page.waitForFunction(()=>document.body.style.overflow!=='hidden',null,{timeout:3000});
  }
  checks.push('8 种宽度布局、手机底部面板、滚动恢复');

  await page.setViewportSize({width:1440,height:900});await page.goto(base+'/?demo=0&view=desktop#/me');await page.getByRole('link',{name:'查看我的关注'}).click();await page.emulateMedia({reducedMotion:'reduce'});await panel().getByRole('link',{name:'查看阿圆不想早八的主页'}).waitFor();if(await panel().evaluate(e=>getComputedStyle(e).transitionDuration)!=='0s')throw new Error('减少动态效果未生效');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.profile-people-dialog').open);await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByRole('link',{name:'查看我的关注'}).click();await panel().getByRole('tab',{name:/^关注/}).focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.profile-people-toolbar [role=tab]:last-child')?.getAttribute('aria-selected')==='true');await close();checks.push('减少动态效果、Escape、方向键切换');

  banned=true;await page.goto(base+'/?demo=0&view=desktop#/me?people=follow');await page.reload();const bannedCalls=calls.filter(c=>c.path==='/user/followings').length;await panel().getByRole('heading',{name:'账号暂时无法使用'}).waitFor();if(calls.filter(c=>c.path==='/user/followings').length!==bannedCalls)throw new Error('封禁用户仍读取');banned=false;
  await page.evaluate(()=>localStorage.setItem('eatwhat-session','null'));await page.reload();const guestCalls=calls.filter(c=>c.path==='/user/followings').length;await panel().getByRole('heading',{name:'登录后，认识更多食友'}).waitFor();if(calls.filter(c=>c.path==='/user/followings').length!==guestCalls)throw new Error('游客仍读取');checks.push('游客与封禁账号门槛');
  if(errors.length||unexpected.length||calls.some(c=>c.method!=='GET'))throw new Error(JSON.stringify({errors,unexpected,writes:calls.filter(c=>c.method!=='GET')}));
  const result={checks,responsive,interceptedRequests:calls.length,realBackendRequests:0,writes:0,pageErrors:errors};await page.evaluate(r=>sessionStorage.setItem('eatwhat-qa-profile-people',JSON.stringify(r)),result);return result;
 }catch(cause){await page.screenshot({path:'output/playwright/profile-people-failure.png'});throw cause}
 finally{await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(saved=>saved.session===null?localStorage.removeItem('eatwhat-session'):localStorage.setItem('eatwhat-session',saved.session),saved);await page.setViewportSize({width:1440,height:900});await page.goto(base+'/?demo=1&view=desktop#/me');await page.reload();await page.unroute(guard);page.off('pageerror',fail)}
}
