async(browserPage)=>{
 const context=await browserPage.context().browser().newContext();
 const page=await context.newPage();
 try {
 const base='http://127.0.0.1:5173/?demo=1&view=desktop',checks=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'#/publish');await page.reload();
 await page.getByRole('heading',{name:'分享一道菜'}).waitFor();await page.getByRole('radio',{name:/袁记云饺/}).waitFor();
 const url=page.url();await page.getByRole('radio',{name:/袁记云饺/}).click();
 await page.getByRole('textbox',{name:'菜名',exact:true}).fill('验收测试菜');await page.getByRole('spinbutton',{name:'价格',exact:true}).fill('0');await page.getByRole('textbox',{name:'推荐理由',exact:true}).fill('桌面发布工作台验收，零元价格和弹窗裁剪。');
 await page.getByRole('radio',{name:'小吃',exact:true}).click();
 await page.locator('input[type="file"]').setInputFiles('prototype/assets/photos/sq_luosi.png');
 await page.getByRole('img',{name:'当前菜品封面',exact:true}).waitFor();
 await page.getByRole('button',{name:'调整照片',exact:true}).click();const dialog=page.getByRole('dialog',{name:'调整菜品照片',exact:true});await dialog.waitFor();
 await dialog.getByRole('slider',{name:'缩放'}).fill('1.4');await page.screenshot({path:'output/playwright/pc-composer-crop.png'});await dialog.getByRole('button',{name:'取消',exact:true}).click();
 if(page.url()!==url||await page.getByRole('textbox',{name:'菜名',exact:true}).inputValue()!=='验收测试菜')throw new Error('取消裁剪丢失内容或跳页');
 await page.getByRole('button',{name:'调整照片',exact:true}).click();await dialog.getByRole('slider',{name:'缩放'}).fill('1.3');
 const frame=dialog.getByRole('group',{name:'照片取景，拖动或使用方向键调整'}),box=await frame.boundingBox();await page.mouse.move(box.x+150,box.y+150);await page.mouse.down();await page.mouse.move(box.x+180,box.y+164,{steps:8});await page.mouse.up();
 await dialog.getByRole('button',{name:'使用这张照片',exact:true}).click();await dialog.waitFor({state:'hidden'});
 if(page.url()!==url)throw new Error('应用裁剪跳离编辑页');checks.push('选店、菜品信息和弹窗裁剪在同页完成；取消与应用均保留内容');
 const data=await page.evaluateHandle(async()=>{const blob=await(await fetch('/prototype/assets/photos/sq_luosi.png')).blob(),dt=new DataTransfer();dt.items.add(new File([blob],'qa-second.png',{type:'image/png'}));return dt});
 await page.locator('.pc-composer-stage').dispatchEvent('drop',{dataTransfer:data});await page.getByRole('button',{name:'选择照片 2',exact:true}).waitFor();
 const firstPhoto=page.getByRole('button',{name:'选择照片 1',exact:true}),secondPhoto=page.getByRole('button',{name:'选择照片 2',exact:true});
 const nextCover=await secondPhoto.locator('img').getAttribute('src');
 await secondPhoto.dragTo(firstPhoto,{sourcePosition:{x:14,y:30},targetPosition:{x:14,y:30}});
 if(await firstPhoto.locator('img').getAttribute('src')!==nextCover||await firstPhoto.getAttribute('aria-pressed')!=='true')throw new Error('拖动更换封面失败');
 await page.getByRole('button',{name:'移除第 2 张照片',exact:true}).click();if(await page.getByRole('button',{name:/^选择照片 /}).count()!==1)throw new Error('删除照片失败');
 await page.getByRole('button',{name:'更多颜色',exact:true}).click();await page.getByRole('button',{name:'瓷蓝',exact:true}).click();checks.push('照片拖放、多图管理、设为封面、删除和舞台色');
 await page.getByRole('button',{name:'更换餐厅',exact:true}).click();await page.getByRole('textbox',{name:'搜索发布餐厅',exact:true}).fill('小碗');await page.getByRole('radio',{name:/小碗菜/}).click();await page.locator('.pc-composer-selected strong').getByText('小碗菜',{exact:true}).waitFor();
 if(await page.getByRole('textbox',{name:'菜名',exact:true}).inputValue()!=='验收测试菜')throw new Error('改选店丢失草稿');
 await page.getByRole('button',{name:'暂存并离开',exact:true}).click();await page.getByRole('link',{name:'发布一道菜',exact:true}).click();
 await page.getByRole('textbox',{name:'菜名',exact:true}).waitFor();if(await page.getByRole('textbox',{name:'菜名',exact:true}).inputValue()!=='验收测试菜'||await page.getByRole('spinbutton',{name:'价格',exact:true}).inputValue()!=='0')throw new Error('暂存返回丢失草稿');
 checks.push('搜索与改选餐厅、暂存离开再继续编辑');
 for(const width of [1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('横向溢出 '+width);await page.getByRole('button',{name:'发布这道菜',exact:true}).waitFor();await page.screenshot({path:'output/playwright/pc-composer-'+width+'.png'})}
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'output/playwright/pc-composer-ready.png'});checks.push('四种 PC 宽度与完整表单、发布操作');
 await page.getByRole('button',{name:'发布这道菜',exact:true}).dblclick();
 await page.waitForURL('**#/me/shares');
 await page.getByRole('heading',{name:'我的上传',exact:true}).waitFor();
 const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem('eatwhat-demo-prototype-v3')).v4.submissions.filter(s=>s.kind==='FOOD'&&s.candidate.name==='验收测试菜'));
 if(pending.length!==1||pending[0].moderationStatus!=='PENDING'||pending[0].candidate.price!==0||pending[0].candidate.restaurantId!==2||pending[0].candidate.category!=='snack')throw new Error('待审核记录或防重复提交不正确');
 checks.push('零元价格、准确餐厅与分类、双击仅提交一次、返回我的上传');
 await page.getByRole('link',{name:'发布一道菜',exact:true}).click();if(await page.getByRole('textbox',{name:'菜名',exact:true}).inputValue()!==''||await page.getByRole('img',{name:'当前菜品封面',exact:true}).count())throw new Error('成功后未清空草稿');
 checks.push('成功后清空草稿');
 await page.reload();await page.getByRole('heading',{name:'分享一道菜'}).waitFor();if(errors.length)throw new Error(errors.join('\n'));return {checks,errors};
 } finally { await context.close(); }
}
