async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:760,height:900});await page.goto('http://127.0.0.1:5173/?demo=1&view=desktop');await page.getByRole('heading',{name:'鲜虾蟹籽 云吞'}).waitFor();await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Desktop design preview overflow');await page.getByRole('navigation',{name:'桌面主导航'}).waitFor();await page.screenshot({path:'output/playwright/pc-preview-760.png'});
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:5174/?demo=1');await page.getByRole('heading',{name:'同校的你，一起好好吃饭',exact:true}).waitFor();if(await page.getByRole('button',{name:'换一个',exact:true}).count())throw new Error('Production enabled demo');
 await page.goto('http://127.0.0.1:5173/?demo=1&view=desktop');await page.getByRole('heading',{name:'鲜虾蟹籽 云吞'}).waitFor();if(errors.length)throw new Error(errors.join('\n'));return {checks:['窄预览区域展示整页 PC 设计','生产产物启动','生产默认关闭演示'],errors};
}
