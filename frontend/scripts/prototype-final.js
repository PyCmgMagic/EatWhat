async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:5173/?demo=1');await page.getByRole('heading',{name:'鲜虾蟹籽 云吞'}).waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'output/prototype/app-home.png'});
 await page.mouse.move(280,260);await page.mouse.down();await page.mouse.move(120,260,{steps:10});await page.mouse.up();
 await page.waitForFunction(()=>!document.querySelector('[aria-label="今天吃什么"] h1')?.textContent?.includes('鲜虾蟹籽'));
 const changed=await page.getByRole('heading',{level:1}).innerText();
 await page.goto('http://127.0.0.1:5173/?demo=1#/restaurants/1');await page.getByRole('heading',{name:'袁记云饺',exact:true}).waitFor();await page.getByRole('heading',{name:'鲜虾蟹籽云吞',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'output/prototype/app-restaurant.png'});
 await page.goto('http://127.0.0.1:5173/?demo=1#/me');await page.getByRole('heading',{name:'天凉被破王',exact:true}).waitFor();await page.getByRole('tab',{name:'足迹',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'output/prototype/app-me.png'});
 await page.getByRole('link').filter({hasText:'粉丝'}).click();await page.getByRole('tab',{name:/粉丝/,selected:true}).waitFor();
 await page.goto('http://127.0.0.1:5174/?demo=1');await page.getByRole('button',{name:'登录',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'output/prototype/production-guest.png'});
 if(await page.getByRole('button',{name:'换一个',exact:true}).count())throw new Error('Production unexpectedly enabled demo');
 await page.goto('http://127.0.0.1:5173/?demo=1');await page.getByRole('heading',{name:'鲜虾蟹籽 云吞'}).waitFor();
 if(errors.length)throw new Error(errors.join('\n'));return {checks:['原生鼠标拖动转盘 '+changed.replace(/\n/g,''),'店内横向列表与实际菜品','个人菜单和粉丝目标','生产产物启动且默认关闭演示'],errors};
}
