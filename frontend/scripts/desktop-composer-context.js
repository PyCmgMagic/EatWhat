async(page)=>{
 const base='http://127.0.0.1:5173/?demo=1&view=desktop',checks=[];
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'#/publish');await page.reload();
 await page.getByRole('radio',{name:/袁记云饺/}).click();await page.getByRole('textbox',{name:'菜名',exact:true}).fill('连贯性验收草稿');
 await page.goto(base+'#/restaurants/2');await page.getByRole('button',{name:'加一道菜',exact:true}).click();
 await page.waitForURL('**#/publish/dish');await page.locator('.pc-composer-selected strong').getByText('小碗菜',{exact:true}).waitFor();
 if(await page.getByRole('textbox',{name:'菜名',exact:true}).inputValue()!=='连贯性验收草稿')throw new Error('从餐厅进入丢失草稿');
 await page.getByRole('button',{name:'暂存并离开',exact:true}).click();await page.getByRole('link',{name:'发布一道菜',exact:true}).click();
 await page.locator('.pc-composer-selected strong').getByText('小碗菜',{exact:true}).waitFor();checks.push('从餐厅详情进入正确带入餐厅；再次暂存返回仍保留餐厅与菜名');
 // Hold the cover decoder so navigation happens before its palette is ready.
 await page.evaluate(()=>{
   const NativeImage=window.Image;
   window.Image=class extends NativeImage {
     get src(){return super.src;}
     set src(url){
       if(!url.startsWith('blob:')){super.src=url;return;}
       window.Image=NativeImage;
       window.finishCoverDecode=()=>{super.src=url;};
     }
   };
 });
 await page.locator('input[type=file]').setInputFiles('prototype/assets/photos/sq_luosi.png');
 await page.waitForFunction(()=>typeof window.finishCoverDecode==='function');
 await page.getByRole('link',{name:'返回发现',exact:true}).click();
 await page.waitForURL('**#/');
 await page.evaluate(()=>window.finishCoverDecode());
 await page.getByRole('link',{name:'发布一道菜',exact:true}).click();
 await page.getByRole('img',{name:'当前菜品封面',exact:true}).waitFor();
 checks.push('选图后立即离开，返回时保留封面和取色结果');
 await page.getByRole('button',{name:'更多颜色',exact:true}).click();await page.getByRole('button',{name:'番茄',exact:true}).click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.pc-composer-stage')).backgroundColor==='rgb(201, 68, 43)');
 await page.getByRole('button',{name:'调整照片',exact:true}).click();await page.getByRole('dialog',{name:'调整菜品照片',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'调整菜品照片',exact:true}).waitFor({state:'hidden'});
 if(await page.getByRole('textbox',{name:'菜名',exact:true}).inputValue()!=='连贯性验收草稿')throw new Error('Escape 丢失草稿');checks.push('深色舞台预览、Escape 取消裁剪');
 await page.setViewportSize({width:760,height:950});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('760px PC 缩放溢出');checks.push('窄窗口 PC 缩放预览');
 await page.setViewportSize({width:1440,height:1000});
 const warning=page.waitForEvent('dialog').then(async dialog=>{
   if(dialog.type()!=='beforeunload')throw new Error('刷新草稿时缺少离开提示');
   await dialog.accept();
 });
 await Promise.all([warning,page.reload()]);
 checks.push('刷新有内容的草稿前显示离开提示');
 await page.goto('http://127.0.0.1:5173/?demo=1&view=desktop&persona=unverified#/publish');await page.getByRole('link',{name:'去完成学生认证',exact:true}).waitFor();
 if(await page.getByRole('form',{name:'发布菜品表单'}).count())throw new Error('未认证可访问发布表单');checks.push('保留学生认证门槛');
 await page.goto(base+'#/publish');await page.getByRole('heading',{name:'分享一道菜'}).waitFor();return {checks};
}
