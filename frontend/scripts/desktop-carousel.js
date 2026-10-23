async(page)=>{
 const base='http://127.0.0.1:5173/?demo=1&view=desktop',checks=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const settle=()=>page.evaluate(async()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
 const current=()=>page.locator('.pc-current-plate img').getAttribute('alt');
 const verify=async()=>{
  await settle();const name=await current();
  if(await page.locator('.pc-hero-copy h1').getAttribute('title')!==name)throw new Error('菜名与当前图片不一致');
  const card=page.locator('.pc-food-card').filter({has:page.getByRole('heading',{name,exact:true})});
  if(await page.getByRole('link',{name:'就它了',exact:true}).getAttribute('href')!==await card.getAttribute('href'))throw new Error('详情链接与当前菜不一致');
  const geometry=await page.evaluate(()=>{
   const main=document.querySelector('.pc-current-plate'),next=document.querySelector('.pc-next-plate'),a=main.getBoundingClientRect(),b=next.getBoundingClientRect();
   const overlap=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
   return {overlap:overlap/(a.width*a.height),opacity:getComputedStyle(main).opacity,zMain:+getComputedStyle(main).zIndex,zNext:+getComputedStyle(next).zIndex};
  });
  if(geometry.overlap>.15||geometry.zMain<=geometry.zNext||geometry.opacity!=='1')throw new Error('预览图覆盖主图 '+JSON.stringify(geometry));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('横向溢出');
 };
 for(const width of [1024,1280,1440,1599,1600,1920,2560]){
  await page.setViewportSize({width,height:1080});await page.goto(base);await page.locator('.pc-current-plate img').waitFor();await verify();
  await page.getByRole('button',{name:'换一个',exact:true}).click();await verify();checks.push('宽度 '+width+' 主图、预览、菜名与详情一致');
 }
 await page.setViewportSize({width:1920,height:1080});await page.goto(base);await page.locator('.pc-current-plate img').waitFor();await settle();
 const nodes=await page.locator('.pc-hero-food > .pc-plate').elementHandles(),names=await page.locator('.pc-hero-food > .pc-plate img').evaluateAll(els=>els.map(el=>el.alt));
 await page.waitForFunction(()=>[...document.querySelectorAll('.pc-hero-food img')].every(img=>img.complete&&img.naturalWidth>0));
 await page.evaluate(()=>{
  window.__carouselMutations=0;window.__carouselProbe={frames:0,blankFrames:0};window.__carouselProbeActive=true;
  window.__carouselObserver=new MutationObserver(records=>{window.__carouselMutations+=records.filter(r=>r.type==='childList').length});
  window.__carouselObserver.observe(document.querySelector('.pc-hero-food'),{childList:true,subtree:true});
  const sample=()=>{if(!window.__carouselProbeActive)return;const probe=window.__carouselProbe;probe.frames++;
   const visible=[...document.querySelectorAll('.pc-hero-food > .pc-plate:not(.pc-next-plate)')].some(el=>getComputedStyle(el).visibility!=='hidden'&&+getComputedStyle(el).opacity>.1);
   if(!visible)probe.blankFrames++;requestAnimationFrame(sample)};requestAnimationFrame(sample);
 });
 for(let i=0;i<names.length;i++){await page.getByRole('button',{name:'换一个',exact:true}).click();if(await current()!==names[(i+1)%names.length])throw new Error('循环切换顺序错误');await verify()}
 checks.push('完整循环首尾切换正确');
 for(let i=0;i<20;i++)await page.getByRole('button',{name:'换一个',exact:true}).click();await verify();
 if(await current()!==names[20%names.length])throw new Error('快速切换丢失操作');
 await page.getByRole('button',{name:'看第 8 道菜',exact:true}).click();await verify();
 await page.getByRole('button',{name:'看第 2 道菜',exact:true}).click();await verify();
 checks.push('连续点击 20 次及跨页圆点切换');
 const group=page.getByRole('group',{name:'推荐转盘，左右拖动换菜'});await group.focus();await group.press('ArrowLeft');await verify();if(await current()!==names[0])throw new Error('键盘左切错误');
 await group.press('ArrowRight');await verify();if(await current()!==names[1])throw new Error('键盘右切错误');
 const box=await group.boundingBox();await page.mouse.move(box.x+box.width*.55,box.y+160);await page.mouse.down();await page.mouse.move(box.x+box.width*.55-100,box.y+160,{steps:10});await page.mouse.up();await verify();if(await current()!==names[2])throw new Error('拖动切换错误');
 await page.mouse.move(box.x+box.width*.55,box.y+160);await page.mouse.down();await page.mouse.move(box.x+box.width*.55+100,box.y+160,{steps:10});await page.mouse.up();await verify();if(await current()!==names[1])throw new Error('右拖方向错误');
 await page.mouse.move(box.x+box.width*.55,box.y+160);await page.mouse.down();await page.mouse.move(box.x+box.width*.55+5,box.y+160);await page.mouse.up();await verify();if(await current()!==names[1])throw new Error('轻点误触发切换');
 checks.push('方向键和鼠标拖动');
 const probe=await page.evaluate(()=>{window.__carouselProbeActive=false;window.__carouselObserver.disconnect();return {...window.__carouselProbe,childMutations:window.__carouselMutations}});
 if(probe.blankFrames||probe.childMutations)throw new Error('闪烁或重建图片节点 '+JSON.stringify(probe));
 for(const node of nodes)if(!await node.evaluate(el=>el.isConnected))throw new Error('图片节点被销毁');
 checks.push('图片节点保持复用，逐帧无全透明空帧');
 await page.getByRole('button',{name:'看第 1 道菜',exact:true}).click();await verify();await page.screenshot({path:'output/playwright/pc-switch-after-1920.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'换一个',exact:true}).click();await verify();
 if(await page.locator('.pc-current-plate').evaluate(el=>getComputedStyle(el).transitionDuration)!=='0s')throw new Error('减少动态效果未生效');
 checks.push('减少动态效果偏好');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:1000});await page.goto(base);await page.locator('.pc-current-plate img').waitFor();await verify();
 const result={checks,probe,errors};await page.evaluate(value=>sessionStorage.setItem('eatwhat-qa-carousel',JSON.stringify(value)),result);if(errors.length)throw new Error(errors.join('\n'));return result;
}
