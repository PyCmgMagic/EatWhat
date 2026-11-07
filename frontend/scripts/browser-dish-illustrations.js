async (page) => {
  const browser=page.context().browser(),engine=browser.browserType().name();
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await context.newPage(),checks=[],errors=[];
  const account={id:10,displayName:'认真吃饭的食友',verified:true,banned:false,role:'user'};
  p.setDefaultTimeout(10000);
  p.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>localStorage.setItem('eatwhat-session',JSON.stringify({tokenName:'x-session',tokenValue:'isolated-illustration-check'})));
  await context.route(u=>u.origin!=='http://127.0.0.1:5173',r=>r.abort());
  await context.route(u=>u.pathname.startsWith('/api/'),r=>{
    const path=new URL(r.request().url()).pathname;
    const data=path==='/api/user/info'?account:path==='/api/user/userInfo'?{...account,id:21,earnedLikes:0,uploadedFoodsCount:0,fansCount:0,followingsCount:0}:path==='/api/campus/list'?[{id:1,name:'软件园',open:true,isDefault:true}]:path==='/api/remote-config'?{configVersion:1,flags:{},params:{},maintenance:{mode:'NONE'},announcements:[],versions:{}}:path==='/api/notification/unread/count'?0:{items:[],totalItems:0,totalPages:0,currentPage:1,hasNext:false};
    return r.fulfill({json:{code:0,data}});
  });
  const base='http://127.0.0.1:5173/?demo=0&view=mobile#';
  const assert=(ok,message)=>{if(!ok)throw Error(message)};
  const inspect=async(rootSelector,dish,title)=>{
    const root=p.locator(rootSelector),img=root.locator('.dish-illustration > img');
    await root.getByRole('heading',{name:title,exact:true}).waitFor();
    await img.evaluate(img=>img.decode());
    await p.evaluate(()=>document.fonts.ready);
    assert((await img.getAttribute('src')).endsWith('/'+dish+'.svg'),'Wrong prototype dish');
    const m=await root.evaluate(root=>{
      const art=root.querySelector('.dish-illustration').getBoundingClientRect(),title=root.querySelector('h2').getBoundingClientRect();
      return{overflow:document.documentElement.scrollWidth>innerWidth,art:{x:art.x,right:art.right,bottom:art.bottom,w:art.width,h:art.height},titleY:title.y,width:innerWidth,decorative:root.querySelector('.dish-illustration').getAttribute('aria-hidden')==='true'};
    });
    assert(!m.overflow&&m.art.x>=0&&m.art.right<=m.width&&Math.abs(m.art.w-m.art.h)<1&&m.art.bottom<m.titleY&&m.decorative,'Artwork clipped, stretched or overlaps the heading: '+JSON.stringify(m));
  };
  try {
    for(const width of [320,390,520]) {
      await p.setViewportSize({width,height:844});
      await p.goto(base+'/me');
      await inspect('.mobile-empty','yuntun','还没有分享过菜');
      await p.getByRole('link',{name:'分享一道菜',exact:true}).click({trial:true});
      if(width===390)await p.screenshot({path:`output/playwright/dish-art-${engine}-my-shares.png`,fullPage:true});
      await p.getByRole('tab',{name:'收藏 0',exact:true}).click();
      await inspect('.mobile-empty','yangzhi','还没有收藏的菜');
      const discover=p.getByRole('link',{name:'去发现',exact:true});
      assert((await discover.getAttribute('href'))==='#/','Favorite empty state lost its discover action');
      await discover.click({trial:true});
      await p.goto(base+'/search?keyword=饺子');
      await inspect('.ew-state','jiaozi','没有找到符合条件的结果，试试放宽条件');
      if(width===390)await p.screenshot({path:`output/playwright/dish-art-${engine}-search.png`,fullPage:true});
      await p.goto(base+'/users/21');
      await inspect('.ew-state','yuntun','还没有符合条件的分享');
      if(width===390)await p.screenshot({path:`output/playwright/dish-art-${engine}-public-profile.png`,fullPage:true});
      await p.goto(base+'/favorites');
      await inspect('.favorites-empty','yangzhi','把喜欢的味道，留给下一餐');
      if(width===390)await p.screenshot({path:`output/playwright/dish-art-${engine}-favorites.png`,fullPage:true});
      checks.push(`${width}px: five real empty states, square decorative artwork, no overflow or overlaps`);
    }
    await context.route('**/prototype/assets/dishes/yangzhi.svg',r=>r.abort());
    await p.reload();await p.locator('.favorites-empty .dish-illustration > svg').waitFor();
    assert(await p.locator('.favorites-empty a').isVisible(),'Missing SVG disables the empty-state action');
    checks.push('An unavailable SVG uses the inline fallback without disabling navigation');
    assert(errors.length===0,errors.join('\n'));
    return{engine,checks:checks.length,details:checks};
  }catch(error){await p.screenshot({path:`output/playwright/dish-art-${engine}-failure.png`,fullPage:true});throw Error(JSON.stringify({error:String(error),checks,errors,text:(await p.locator('body').innerText()).slice(0,1300)}))}
  finally{await context.close()}
}
