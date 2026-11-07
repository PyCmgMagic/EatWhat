async (page) => {
  const browser=page.context().browser(),engine=browser.browserType().name();
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await context.newPage(),checks=[];
  let broken=true,artUnavailable=false;
  p.setDefaultTimeout(10000);
  await context.route(u=>u.origin!=='http://127.0.0.1:5173',r=>r.abort());
  await context.route('**/prototype/assets/dishes/yuntun.svg',r=>artUnavailable?r.abort():r.continue());
  // Inject the failure at the real app boundary without changing source files.
  await context.route(u=>u.pathname==='/src/mobile/App.tsx',r=>broken?r.fulfill({contentType:'application/javascript',body:'export default function BrokenApp(){throw new Error("isolated-recovery-layout-check")}'}):r.continue());
  await context.route(u=>u.pathname.startsWith('/api/'),r=>{
    const path=new URL(r.request().url()).pathname;
    const data=path==='/api/campus/list'?[{id:1,name:'软件园',open:true,isDefault:true}]:path==='/api/foods/recommend'?[]:path==='/api/remote-config'?{configVersion:1,flags:{},params:{},maintenance:{mode:'NONE'},announcements:[],versions:{}}:{items:[],totalItems:0,hasNext:false};
    return r.fulfill({json:{code:0,data}});
  });
  const base='http://127.0.0.1:5173/?demo=0&view=mobile#/nearby';
  const assert=(ok,message)=>{if(!ok)throw Error(message)};
  try {
    await p.goto(base);
    for(const [width,height] of [[320,568],[360,740],[390,844],[430,932],[1024,768],[390,480]]) {
      await p.setViewportSize({width,height});
      await p.getByRole('heading',{name:/页面遇到\s*一点问题/}).waitFor();
      await p.evaluate(()=>document.fonts.ready);
      await p.locator('.fatal-error-illustration img').evaluate(img=>img.decode());
      const m=await p.evaluate(()=>{
        const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right}};
        const actions=[...document.querySelectorAll('.fatal-error-action')];
        return{overflow:document.documentElement.scrollWidth>innerWidth,actions:actions.map(rect),head:rect(document.querySelector('h1')),description:rect(document.querySelector('.fatal-error-description')),art:rect(document.querySelector('.fatal-error-illustration')),note:rect(document.querySelector('.fatal-error-note')),bg:getComputedStyle(document.querySelector('.fatal-error')).backgroundColor,font:getComputedStyle(document.querySelector('h1')).fontFamily,focused:document.activeElement===document.querySelector('h1')};
      });
      assert(!m.overflow&&m.actions.every(r=>r.h>=52&&r.x>=0&&r.right<=width),'Overflow or small recovery actions: '+JSON.stringify(m));
      assert(m.art.bottom<=m.head.y&&m.head.bottom<=m.description.y&&m.actions[0].bottom<m.note.y,'Content overlaps');
      assert(m.bg==='rgb(255, 255, 255)'&&m.font.includes('Noto Sans SC'),'Fallback depends on failed page styling');
      assert(!await p.getByText('isolated-recovery-layout-check').count(),'Internal error disclosed');
      if(width===390&&height===844)await p.screenshot({path:`output/playwright/error-boundary-${engine}-390.png`,fullPage:true});
      if(width===320)await p.screenshot({path:`output/playwright/error-boundary-${engine}-320.png`,fullPage:true});
      if(width===1024)await p.screenshot({path:`output/playwright/error-boundary-${engine}-desktop.png`,fullPage:true});
      checks.push(`${width}x${height}: standalone white recovery page, no overlaps, 52px actions`);
    }
    await p.setViewportSize({width:390,height:844});
    artUnavailable=true;await p.reload();
    await p.locator('.fatal-error-illustration .dish-illustration > svg').waitFor();
    assert(await p.locator('.fatal-error-action').count()===2,'Missing artwork breaks recovery');
    checks.push('Unavailable artwork falls back locally and preserves both recovery actions');
    await p.evaluate(()=>document.querySelector('h1').focus());
    await p.keyboard.press('Tab');
    assert(await p.getByRole('link',{name:'回到首页',exact:true}).evaluate(el=>el===document.activeElement),'Keyboard cannot reach home: '+await p.evaluate(()=>document.activeElement.outerHTML));
    await p.keyboard.press('Tab');
    assert(await p.getByRole('button',{name:'重新加载',exact:true}).evaluate(el=>el===document.activeElement),'Keyboard cannot reach retry');
    broken=false;
    await p.getByRole('button',{name:'重新加载',exact:true}).click();
    await p.locator('.mobile-nearby-screen').waitFor();
    assert(p.url()===base,'Retry changed route');
    checks.push('Retry reloads the same route and restores the real application');
    broken=true;await p.reload();await p.locator('.fatal-error').waitFor();
    broken=false;await p.getByRole('link',{name:'回到首页',exact:true}).click();
    await p.locator('.mobile-home-screen').waitFor();
    assert(new URL(p.url()).hash==='#/'&&new URL(p.url()).search==='?demo=0&view=mobile','Home lost app mode or failed to reset route');
    assert(await p.locator('.fatal-error').count()===0,'Home leaves the error boundary mounted');
    checks.push('Home changes the hash and performs a real reload, preserving app mode');
    return{engine,checks:checks.length,details:checks};
  }catch(error){await p.screenshot({path:`output/playwright/error-boundary-${engine}-failure.png`,fullPage:true});throw Error(JSON.stringify({error:String(error),checks,text:(await p.locator('body').innerText()).slice(0,1000)}))}
  finally{await context.close()}
}
