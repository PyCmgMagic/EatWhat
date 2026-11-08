async (page) => {
  const base = 'http://127.0.0.1:5173';
  const browser = page.context().browser(), engine = browser.browserType().name();
  const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p = await context.newPage(), checks = [], errors = [];
  const food = {
    id: 71, name: '招牌红烧牛筋牛肉手工拉面加煎蛋', restaurantName: '校园美食广场一楼汤见手工牛肉面馆',
    restaurantId: 9, price: 18.9, category: 'staple', stageColor: 'soy',
    description: '这是一段完整的菜品介绍。'.repeat(30),
    pictureUrl: ['/prototype/assets/photos/sq_luosi.png'], systemTags: [], myCustomTags: [],
    likesCount: 12, isLiked: false, isFavorite: false,
  };
  const foods = Array.from({length:5},(_,i)=>({...food,id:71+i,name:i?`推荐菜品${i+1}`:food.name}));
  p.setDefaultTimeout(10000);
  p.on('pageerror', e=>errors.push(e.message));
  await p.emulateMedia({reducedMotion:'reduce'});
  await context.route(url=>url.origin!==base,route=>route.abort());
  await context.route(url=>url.pathname.startsWith('/api/'),route=>{
    const url=new URL(route.request().url());
    let data={items:[],totalItems:0,hasNext:false};
    if(url.pathname==='/api/foods/recommend') data=foods;
    else if(url.pathname.startsWith('/api/foods/detail/')) data=food;
    else if(url.pathname==='/api/campus/list') data=[{id:1,name:'软件园',open:true,isDefault:true}];
    else if(url.pathname==='/api/remote-config') data={configVersion:1,flags:{},params:{},maintenance:{mode:'NONE'},announcements:[],versions:{}};
    else if(url.pathname.includes('/tags')) data={systemTags:[],myCustomTags:[]};
    else if(url.pathname.includes('/topics')) data=[];
    return route.fulfill({status:200,json:{code:0,data}});
  });
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
  const settled=()=>p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  const noOverflow=async()=>{
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page scrolls sideways');
    assert(await p.locator('.v4-mobile-nav').count()===0,'Duplicate footer navigation remains');
  };
  const hit=async(locator)=>{
    await locator.scrollIntoViewIfNeeded();
    const ok=await locator.evaluate(el=>{
      const r=el.getBoundingClientRect(), x=(Math.max(0,r.left)+Math.min(innerWidth,r.right))/2,y=(Math.max(0,r.top)+Math.min(innerHeight,r.bottom))/2;
      const target=document.elementFromPoint(x,y);
      return r.bottom>0&&r.top<innerHeight&&target&&(target===el||el.contains(target));
    });
    assert(ok,'Control is covered: '+await locator.innerText());
  };
  try {
    for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[520,900]]) {
      await p.setViewportSize({width,height});
      for(const path of ['/','/home-photo']) {
        await p.goto(base+'/?demo=0&view=mobile#'+path);
        await p.locator('.mobile-home-copy h1').filter({hasText:food.name}).waitFor();
        await settled();
        await noOverflow();
        assert(await p.locator('.mobile-home-copy h1').innerText()===food.name,'Long food name was truncated');
        const fits=await p.evaluate(()=>{
          const box=s=>document.querySelector(s).getBoundingClientRect();
          const title=box('.mobile-home-copy h1'), shop=box('.mobile-home-shop'), price=box('.mobile-home-price'), actions=box('.mobile-home-actions'), sheet=box('.mobile-home-sheet');
          const photos=[...document.querySelectorAll('.mobile-home-plate')].filter(el=>Number(getComputedStyle(el).opacity)>0).map(el=>el.getBoundingClientRect());
          return photos.every(photo=>photo.left>=Math.max(title.right,shop.right,price.right))&&title.bottom<=shop.top+1&&shop.bottom<=price.top+1&&price.bottom<=actions.top+1&&actions.bottom<=sheet.top+1;
        });
        assert(fits,'Real text overlaps restaurant, price or actions');
        await hit(p.getByRole('link',{name:'就它了',exact:true}));
        assert(await p.locator('.design-food-tile').count()===foods.length,'Loaded recommendations are hidden');
        assert(await p.getByRole('button',{name:'再看几道',exact:true}).count()===0,'Recommendations still require expansion');
        await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
        await hit(p.locator('.design-food-tile').last());
        const nav=p.getByRole('navigation',{name:'主导航',exact:true});
        const bounds=await nav.boundingBox();
        assert(bounds.y>=0&&bounds.y+bounds.height<=height+1,'Navigation is outside the viewport');
        await hit(nav.getByRole('link',{name:'附近',exact:true}));
        await p.evaluate(()=>window.scrollTo(0,0));
        await p.locator('.mobile-home-toolbar > a').click();
        const dialog=p.getByRole('dialog',{name:'地点和饭点',exact:true});
        await dialog.waitFor();
        await settled();
        const panel=await dialog.boundingBox();
        assert(panel.x>=-1&&panel.x+panel.width<=width+1&&panel.y>=-1&&panel.y+panel.height<=height+1,'Place/meal panel overflows');
        await dialog.getByRole('link',{name:'关闭',exact:true}).click();
        await dialog.waitFor({state:'hidden'});
        if(width===390&&path==='/') await p.screenshot({path:`output/playwright/mobile-layout-${engine}-real-home.png`,fullPage:true});
        checks.push(`${width}x${height} ${path}: full names, photo, expanding list, navigation and place/meal dialog`);
      }
      await p.goto(base+'/?demo=0&view=mobile#/foods/71');
      await p.locator('.mobile-contributor').waitFor();
      await p.locator('.mobile-food-footer').waitFor();
      await settled();
      await noOverflow();
      const sequential=await p.evaluate(()=>{
        const text=document.querySelector('.mobile-contributor').parentElement.getBoundingClientRect();
        const sheet=document.querySelector('.mobile-detail-sheet').getBoundingClientRect();
        const extras=document.querySelector('.mobile-food-footer').getBoundingClientRect();
        return !document.querySelector('.v4-mobile-extras')&&text.bottom<=extras.top+1&&extras.bottom<=sheet.bottom+1;
      });
      assert(sequential,'Description, detail sheet and feedback overlap');
      await hit(p.getByRole('link',{name:'举报这道菜',exact:true}));
      checks.push(`${width}x${height} detail: feedback is reachable within the same detail sheet`);
    }
    for(const [width,height] of [[320,568],[390,844],[430,932]]) {
      await p.setViewportSize({width,height});
      for(const path of ['/nearby','/restaurants/1','/search','/me','/settings','/verify','/publish','/publish/dish','/auth','/me/edit','/favorites','/notifications']) {
        await p.goto(base+'/?demo=1#'+path);
        await p.locator('.design-screen:visible,.ew-mobile-feature:visible,.mobile-page-native:visible,.ew-login:visible,.profile-mobile-page:visible').first().waitFor();
        await settled();
        await noOverflow();
        if(path==='/publish/dish') {
          const meal=p.getByRole('group',{name:'适合的饭点'});
          await meal.waitFor();
          await hit(meal.locator('input').last());
          await hit(p.getByText('发布',{exact:true}));
        }
        if(path==='/nearby') await hit(p.getByRole('link',{name:'更多筛选',exact:true}));
        checks.push(`${width}x${height} ${path}: no horizontal overflow or duplicate navigation`);
      }
    }
    assert(errors.length===0,errors.join('\n'));
    return {engine,checks:checks.length,details:checks,errors,realBackendRequests:0};
  } catch(error) {
    await p.screenshot({path:`output/playwright/mobile-layout-${engine}-failure.png`,fullPage:true});
    throw new Error(JSON.stringify({engine,checks,error:String(error),url:p.url(),text:(await p.locator('body').innerText()).slice(0,1600),errors}));
  } finally {await context.close()}
}
