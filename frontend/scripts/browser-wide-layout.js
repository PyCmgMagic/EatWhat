async (page) => {
  const browser = page.context().browser(), engine = browser.browserType().name();
  const base = "http://127.0.0.1:5173";
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 }, reducedMotion: "reduce" });
  const p = await context.newPage(), checks = [], errors = [], writes = [];
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  p.setDefaultTimeout(15000);
  p.on("pageerror", error => { if (!error.message.includes("ResizeObserver loop")) errors.push(error.message.replace(/ak=[^&\s]+/g,"ak=[redacted]")); });
  const foods = ["PyCmgMagic", "招牌牛筋面", "茶碗蒸", "火炙芝士牛肉"].map((name,i) => ({
    id:91+i,name,category:"staple",price:10+i,restaurantId:1,restaurantName:"校园食堂",
    pictureUrl:[i%2?"/prototype/assets/photos/sq_tieguo.png":"/prototype/assets/photos/sq_luosi.png"],
    stageColor:"broth",likesCount:i,isLiked:false,isFavorite:false,
  }));
  const shops = Array.from({length:8},(_,i) => ({id:i+1,name:i===1?"食堂二号店":`校园餐厅 ${i+1}`,
    address:`软件园美食街 ${i+1} 号`,gcjLng:117.1401+i*0.0005,gcjLat:36.6673+i*0.0003,pictureUrl:[]}));
  await context.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success,error) => error?.({code:1,message:"Test location disabled"});
  });
  // Only map SDK/tiles may leave localhost; all business endpoints are isolated.
  await context.route(url => url.origin !== base && !/(^|\.)(baidu\.com|bdimg\.com|bdstatic\.com)$/.test(url.hostname), route => route.abort());
  await context.route(url => url.origin===base && url.pathname.startsWith("/api/"), route => {
    const url = new URL(route.request().url()), path = url.pathname;
    if (route.request().method() !== "GET") { writes.push(path); return route.abort(); }
    let data=[];
    if (path==="/api/foods/recommend") data=foods;
    else if (["/api/restaurant/browse","/api/restaurant/search"].includes(path)) data={items:shops,totalItems:shops.length,hasNext:false};
    else if (path==="/api/campus/list") data=[{id:1,name:"软件园",open:true,isDefault:true,gcjLng:117.1401,gcjLat:36.6673}];
    else if (path==="/api/remote-config") data={configVersion:1,flags:{},params:{batchSize:4},maintenance:{mode:"NONE"},announcements:[],versions:{}};
    else if (path==="/api/foods/detail/91") data=foods[0];
    else if (path==="/api/restaurant/detail/1") data=shops[0];
    return route.fulfill({json:{code:0,data}});
  });
  const settled = () => p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll(".pc-plate img")].map(img=>{img.loading="eager";return img.decode();}));
    window.scrollTo(0,0);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  const measure = () => p.evaluate(() => {
    const rect = selector => {const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
    const header=[".pc-brand",".pc-header nav",".pc-header-actions"].map(rect);
    return {viewport:{w:innerWidth,h:innerHeight},main:rect(".pc-main"),footer:rect(".pc-footer"),
      content:rect(".pc-hero")??rect(".pc-nearby-layout"),map:rect(".pc-map"),sheet:rect(".pc-discovery-sheet"),
      title:rect(".pc-hero-copy h1"),copy:rect(".pc-hero-copy"),actions:rect(".pc-hero-actions"),
      art:[...document.querySelectorAll(".pc-food-card-image .pc-plate")].map(e=>({w:e.offsetWidth,h:e.offsetHeight,right:getComputedStyle(e).right})),
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      zoom:getComputedStyle(document.querySelector(".pc-app")).zoom,
      overlap:header.some((a,i)=>header.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1))};
  });
  try {
    for (const route of ["/","/nearby"]) {
      await p.goto(base+"/?demo=0&view=desktop#"+route);
      await p.locator(route==="/"?".pc-home .pc-food-card":".pc-shop-row").first().waitFor();
      for (const [width,height] of [[2560,1440],[1920,1080],[2560,900],[1920,600],[1536,700],[1440,900],[1280,720],[820,700],[600,800]]) {
        await p.setViewportSize({width,height});
        await settled();
        const m=await measure();
        assert(!m.overflow&&!m.overlap&&m.zoom==="1", "Overflow, overlap or whole-page scaling: "+JSON.stringify(m));
        if(width>=1600) assert(m.content.w/width>.82, "Wide browsing still occupies too little of the viewport: "+JSON.stringify(m));
        if(route==="/") {
          assert(m.art.length===4&&m.art.every(a=>Math.abs(a.w-a.h)<1&&parseFloat(a.right)<0),"Card circles lost their shape or right alignment");
          assert(m.copy.bottom<m.actions.y,"Title/price overlaps the carousel actions");
          if(height<=780) assert(m.content.h<=440,"Wide but short windows have an oversized hero");
          if(width>=1600&&height>=1080) assert(m.art[0].w>250,"Card photos did not adapt to the wide grid");
        } else if(width>=768) {
          assert(m.content.h>340&&m.content.bottom<=height-50,"Map no longer fits the available height: "+JSON.stringify(m));
          if(height>=1080) assert(m.content.h/height>.7,"Map leaves excessive unused space below it: "+JSON.stringify(m));
        }
        checks.push({route,width,height,contentWidth:Math.round(m.content.w),panelHeight:Math.round(m.content.h),margin:Math.round(m.content.x)});
        if(width===2560&&height===1440) {
          if(route==="/nearby") {
            await p.locator('.restaurant-map-canvas[data-map-state="ready"]').waitFor({timeout:30000});
            await settled();
          }
          await p.screenshot({path:`output/playwright/wide-layout-${engine}-${route==="/"?"home":"nearby"}.png`});
        }
      }
      if(route==="/nearby") {
        await p.locator(".pc-shop-row").filter({has:p.getByText("食堂二号店",{exact:true})}).click();
        await p.locator(".pc-map-selected").getByRole("heading",{name:"食堂二号店",exact:true}).waitFor();
      }
    }
    // The wide browsing correction must not enlarge reading/form pages again.
    await p.setViewportSize({width:2560,height:1440});
    await p.goto(base+"/?demo=0&view=desktop#/foods/91");
    await p.getByRole("heading",{name:foods[0].name,exact:true}).waitFor();
    const detail=await p.locator(".pc-main").evaluate(e=>e.offsetWidth);
    assert(detail<=1360,"Dish details were widened with browse pages");
    await p.goto(base+"/?demo=0&view=desktop#/auth/password");
    await p.locator('input[name="username"]').waitFor();
    const auth=await p.locator(".pc-main").evaluate(e=>e.offsetWidth);
    assert(auth<=1360,"Auth forms were widened with browse pages");
    assert(writes.length===0&&errors.length===0,JSON.stringify({writes,errors}));
    return {engine,checks,detailWidth:detail,authWidth:auth,realBusinessRequests:0};
  } catch(error) {
    await p.screenshot({path:`output/playwright/wide-layout-${engine}-failure.png`});
    throw error;
  } finally {await context.close();}
}
