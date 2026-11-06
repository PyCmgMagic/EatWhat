async(page)=>{
 const base='http://127.0.0.1:5173/?demo=1&view=desktop',errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 const settle=()=>page.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))});
 const align=async(selector)=>{
  await settle();await page.waitForFunction(selector=>{const root=document.querySelector(selector),active=root?.querySelector('[aria-current="page"],[aria-selected="true"]'),marker=root?.querySelector('.pc-tab-indicator');if(!active||!marker)return false;const a=active.getBoundingClientRect(),b=marker.getBoundingClientRect();return Math.abs(a.left-b.left)<=1&&Math.abs(a.width-b.width)<=1},selector);const result=await page.locator(selector).evaluate(root=>{
   const active=root.querySelector('[aria-current="page"],[aria-selected="true"]'),marker=root.querySelector('.pc-tab-indicator');
   const a=active.getBoundingClientRect(),b=marker.getBoundingClientRect();return {left:Math.abs(a.left-b.left),width:Math.abs(a.width-b.width)};
  });if(result.left>1||result.width>1)throw new Error('指示器错位 '+selector+JSON.stringify(result));
 };
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'#/nearby');await page.reload();await page.getByRole('heading',{name:'好吃的，就在附近'}).waitFor();
 await align('.pc-nav-tabs');const indicator=await page.locator('.pc-nav-tabs > .pc-tab-indicator').elementHandle(),region=await page.locator('.pc-main > .pc-motion-region').elementHandle();
 const widths=await page.locator('.pc-nav-tabs > a').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));
 const nav=page.getByRole('navigation',{name:'桌面主导航'});
 await nav.getByRole('link',{name:'发现',exact:true}).click();
 const timing=await page.locator('.pc-main > .pc-motion-region').evaluate(el=>el.getAnimations().map(a=>({duration:a.effect.getTiming().duration,properties:Object.keys(a.effect.getKeyframes()[0])})));
 if(!timing.some(t=>t.duration===180))throw new Error('页面过渡未播放');
 await page.getByRole('heading',{name:'鲜虾蟹籽 云吞'}).waitFor();await align('.pc-nav-tabs');
 for(const name of ['我的','附近','发现','附近','我的','发现','我的','附近','发现'])await nav.getByRole('link',{name,exact:true}).click();
 await align('.pc-nav-tabs');if(!await indicator.evaluate(el=>el.isConnected)||!await region.evaluate(el=>el.isConnected))throw new Error('导航指示器或内容容器被重建');
 const later=await page.locator('.pc-nav-tabs > a').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));if(widths.some((w,i)=>Math.abs(w-later[i])>.5))throw new Error('顶部标签选中后宽度变化');
 checks.push('顶部滑块与 180ms 内容过渡、快速往返、固定标签宽度');
 await page.goto(base);await page.getByRole('heading',{name:'鲜虾蟹籽 云吞'}).waitFor();await settle();
 const tabs=page.getByRole('tablist',{name:'推荐分类'}),positions=await tabs.getByRole('tab').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().left));
 const footer=await page.locator('.pc-footer').evaluate(el=>el.getBoundingClientRect().top+scrollY);
 for(const name of ['主食','饮品','小吃','甜品','今日推荐']){
  await tabs.getByRole('tab',{name,exact:true}).click();await align('.pc-tabs[aria-label="推荐分类"]');
  const now=await tabs.getByRole('tab').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().left));if(positions.some((p,i)=>Math.abs(p-now[i])>.5))throw new Error('分类标签位置跳动');
  if(Math.abs(await page.locator('.pc-footer').evaluate(el=>el.getBoundingClientRect().top+scrollY)-footer)>2)throw new Error('分类内容高度导致页脚跳动');
 }
 checks.push('首页分类滑块、文字稳定、空分类与页脚高度稳定');
 await tabs.getByRole('tab',{name:'今日推荐',exact:true}).focus();await page.keyboard.press('ArrowRight');
 if(await tabs.getByRole('tab',{name:'主食',exact:true}).getAttribute('aria-selected')!=='true')throw new Error('键盘方向切换失败');
 if(await tabs.locator('.pc-tab-indicator').evaluate(el=>getComputedStyle(el).transitionDuration)!=='0s')throw new Error('键盘操作仍有动画延迟');
 if(await page.locator('.pc-category-content').evaluate(el=>el.getAnimations().length))throw new Error('键盘内容切换仍有动画');checks.push('方向键即时切换、焦点与选中状态同步');
 await page.goto(base+'#/me');await page.reload();await page.locator('.pc-profile-tab-content .pc-food-card').first().waitFor();await settle();
 const myTabs=page.getByRole('tablist',{name:'我的内容'}),oldCount=await page.locator('.pc-profile-tab-content .pc-food-card').count();
 await myTabs.getByRole('tab',{name:/收藏/}).click();
 const pending=await page.locator('.pc-profile-tab-content').getAttribute('aria-busy');
 if(pending==='true'&&await page.locator('.pc-profile-tab-content .pc-food-card').count()!==oldCount)throw new Error('加载中清空旧列表');
 await page.waitForFunction(()=>document.querySelector('.pc-profile-tab-content')?.getAttribute('aria-busy')==='false');await align('.pc-tabs[aria-label="我的内容"]');
 for(const name of [/上传/,/收藏/,/上传/,/收藏/])await myTabs.getByRole('tab',{name}).click();
 await align('.pc-tabs[aria-label="我的内容"]');checks.push('我的上传/收藏保留加载内容、连续切换');
 for(const width of [1024,1280,1440,1920]){
  await page.setViewportSize({width,height:1000});await nav.getByRole('link',{name:'附近',exact:true}).click();await align('.pc-nav-tabs');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('响应式横向溢出 '+width);
 }checks.push('1024/1280/1440/1920px 导航对齐与无溢出');
 await page.emulateMedia({reducedMotion:'reduce'});await nav.getByRole('link',{name:'发现',exact:true}).click();await align('.pc-nav-tabs');
 if(await page.locator('.pc-nav-tabs > .pc-tab-indicator').evaluate(el=>getComputedStyle(el).transitionDuration)!=='0s')throw new Error('减少动态效果仍播放滑块');
 if(await page.locator('.pc-main > .pc-motion-region').evaluate(el=>el.getAnimations().length))throw new Error('减少动态效果仍播放页面过渡');
 checks.push('减少动态效果即时切换');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:760,height:950});await page.goto(base+'#/nearby');await align('.pc-nav-tabs');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('窄屏 PC 布局横向溢出');checks.push('760px PC 布局重新排版，指示器对齐');
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'#/nearby');await page.getByRole('heading',{name:'好吃的，就在附近'}).waitFor();await settle();await page.screenshot({path:'output/playwright/pc-tabs-nearby.png'});
 const result={checks,pageTransition:timing,errors};await page.evaluate(value=>sessionStorage.setItem('eatwhat-qa-tabs',JSON.stringify(value)),result);if(errors.length)throw new Error(errors.join('\n'));return result;
}
