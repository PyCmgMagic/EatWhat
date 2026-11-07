async (page) => {
  const base='http://127.0.0.1:5173', browser=page.context().browser();
  const engine=browser.browserType().name(), checks=[], errors=[];
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await context.newPage();p.setDefaultTimeout(10000);
  await p.emulateMedia({reducedMotion:'reduce'});
  await context.addInitScript(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__testShare=data}}));
  const standard={id:71,name:'招牌牛筋面',restaurantId:9,price:18.9,category:'staple',stageColor:'soy',description:'免费加面，牛筋软糯，汤底很香。',uploaderName:'rpc',accountId:21,createdAt:Date.now()-9*3600000,pictureUrl:['/prototype/assets/photos/sq_luosi.png'],systemTags:[],myCustomTags:[],likesCount:1,isLiked:false,isFavorite:false};
  let food=standard, mutationRequests=0;
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',msg=>{if(msg.type()==='error'&&!msg.text().startsWith('Failed to load resource'))errors.push(msg.text())});
  await context.route(url=>url.origin!==base,route=>route.abort());
  await context.route(url=>url.pathname.startsWith('/api/'),route=>{
    const path=new URL(route.request().url()).pathname;
    if(route.request().method()!=='GET')mutationRequests++;
    let data={items:[],totalItems:0,hasNext:false};
    if(path.startsWith('/api/foods/detail/'))data=food;
    else if(path.startsWith('/api/restaurant/detail/'))data={id:9,name:'汤见17码头',address:'CCPARK济高云泉中心一楼'};
    else if(path==='/api/campus/list')data=[{id:1,name:'软件园',open:true,isDefault:true}];
    else if(path.includes('/topics'))data=[];
    else if(path.includes('/tags'))data={systemTags:[],myCustomTags:[]};
    else if(path==='/api/remote-config')data={configVersion:1,flags:{},params:{},maintenance:{mode:'NONE'},announcements:[],versions:{}};
    return route.fulfill({status:200,json:{code:0,data}});
  });
  const assert=(ok,message)=>{if(!ok)throw new Error(message)};
  const settle=async()=>{
    await p.locator('.mobile-food-footer').waitFor();
    await p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  };
  const hit=async locator=>{
    await locator.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    assert(await locator.evaluate(el=>{const r=el.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return target&&(el===target||el.contains(target))}),'Control is obscured: '+await locator.getAttribute('aria-label'));
  };
  try {
    for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[520,900]]) {
      await p.setViewportSize({width,height});
      for(const variant of ['short','long','missing']) {
        food=variant==='short'?standard:variant==='long'?{...standard,name:'招牌红烧牛筋牛肉手工拉面加煎蛋',description:'这是食友分享的一段较长的用餐感受。'.repeat(20),likesCount:123456,isLiked:true,systemTags:[{id:1,name:'牛筋软糯',count:12},{id:2,name:'适合喜欢浓郁汤底的食友',count:8}]}:{...standard,name:'',price:null,restaurantId:null,pictureUrl:[],description:'',createdAt:null};
        await p.goto(base+'/?demo=0#/foods/71');await p.reload();await settle();
        assert(await p.locator('.mobile-dish-screen h1').innerText()===(food.name||'这道菜'),'Food name missing or truncated');
        const layout=await p.evaluate(()=>{
          const box=s=>document.querySelector(s).getBoundingClientRect();
          const tools=[...document.querySelectorAll('.dish-toolbar .dish-icon-button')].map(el=>el.getBoundingClientRect());
          const controls=[...document.querySelectorAll('.dish-actions > *')].map(el=>el.getBoundingClientRect());
          const story=box('.dish-story'),tastes=box('.dish-tastes'),footer=box('.mobile-food-footer'),copy=box('.dish-hero-copy'),photo=box('.dish-plate');
          const overflow=[...document.querySelectorAll('.dish-actions > *, .dish-shop-copy, .dish-description, .dish-tag-list > button')].some(el=>el.scrollWidth>el.clientWidth+2);
          return {viewport:document.documentElement.scrollWidth<=innerWidth+1,tools:tools.every(r=>r.width>=43&&r.height>=43),align:Math.abs(controls[0].y-controls[1].y)<1&&Math.abs(controls[0].height-controls[1].height)<1&&controls[0].right<controls[1].left,order:story.bottom<=tastes.top&&tastes.bottom<=footer.top,photo:copy.right<photo.left,overflow};
        });
        assert(layout.viewport&&layout.tools&&layout.align&&layout.order&&layout.photo&&!layout.overflow,JSON.stringify({width,variant,layout}));
        assert(await p.locator('.dish-toolbar .ew-food-manage,.v4-mobile-extras').count()===0,'Detached management or feedback remains');
        assert(await p.getByText('敬请期待',{exact:true}).count()===0,'Unavailable comment placeholder remains');
        assert(await p.getByRole('heading',{name:'大家怎么说',exact:true}).count()===0,'Empty oversized heading remains');
        await hit(p.getByRole('button',{name:'分享菜品',exact:true}));
        await p.getByRole('button',{name:'分享菜品',exact:true}).click();
        assert(await p.evaluate(()=>window.__testShare?.url===location.href),'Share did not receive the current food URL');
        await hit(p.getByRole('button',{name:'收藏',exact:true}));
        await hit(p.locator('.dish-like'));
        if(variant==='short') {
          await p.getByText('汤见17码头',{exact:true}).waitFor();
          assert(await p.getByRole('link',{name:'去这家店',exact:true}).getAttribute('href')==='#/restaurants/9','Restaurant target changed');
          await p.evaluate(()=>window.scrollTo(0,0));
          if(width===390||width===320)await p.screenshot({path:`output/playwright/dish-layout-${engine}-${width}.png`,fullPage:true});
        }
        checks.push(`${width} ${variant}: aligned actions, clear header, full content, working share`);
      }
    }
    food=standard;
    await p.goto(base+'/?demo=0#/foods/71');await p.reload();await settle();
    await p.locator('.dish-like').click();
    await p.getByRole('dialog',{name:'登录 / 注册',exact:true}).waitFor();
    await p.getByRole('button',{name:'关闭登录',exact:true}).click();
    assert(mutationRequests===0,'Guest like sent a backend mutation');
    checks.push('Guest like keeps the login gate');

    await p.setViewportSize({width:390,height:844});
    await p.goto(base+'/?demo=1#/foods/1');await settle();
    const favorite=p.locator('.dish-toolbar button[aria-pressed]');
    const oldFavorite=await favorite.getAttribute('aria-pressed');
    await favorite.click();
    await p.waitForFunction(old=>document.querySelector('.dish-toolbar button[aria-pressed]')?.getAttribute('aria-pressed')!==old,oldFavorite);
    const like=p.locator('.dish-like'),oldLike=await like.getAttribute('aria-pressed');
    await like.click();
    await p.waitForFunction(old=>document.querySelector('.dish-like')?.getAttribute('aria-pressed')!==old,oldLike);
    const manage=p.locator('.dish-sheet .ew-food-manage');await manage.waitFor();
    assert(await manage.getByRole('link',{name:'编辑菜品',exact:true}).getAttribute('href')==='#/foods/1/edit','Owner edit disappeared');
    await hit(manage.getByRole('button',{name:'删除',exact:true}));
    await p.getByRole('button',{name:'添加标签',exact:true}).click();
    await p.getByRole('dialog').waitFor();await p.keyboard.press('Escape');
    checks.push('Owner like, favorite, tag panel, edit and delete entry preserved in demo mode');
    assert(!errors.length,errors.join('\n'));
    return {engine,checks:checks.length,details:checks,errors,realBackendRequests:0};
  }catch(error){
    await p.screenshot({path:`output/playwright/dish-layout-${engine}-failure.png`,fullPage:true});
    throw new Error(JSON.stringify({engine,checks,error:String(error),errors,url:p.url(),text:(await p.locator('body').innerText()).slice(0,1300)}));
  }finally{await context.close()}
}
