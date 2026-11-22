async (page) => {
 const base='http://127.0.0.1:5173/?demo=1&view=desktop#',checks=[],errors=[],widths=[];
 const onError=e=>errors.push(e.message);page.on('pageerror',onError);
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/foods/4');await page.locator('#food-discussion').waitFor();
 const original=await page.evaluate(()=>localStorage.getItem('eatwhat-demo-comments-v1'));
 try {
  await page.evaluate(()=>localStorage.removeItem('eatwhat-demo-comments-v1'));await page.reload();
  await page.goto(base+'/foods/4?section=comments');
  await page.getByRole('article',{name:'小林的评论',exact:true}).waitFor();
  if(await page.locator('.food-comment').count()!==3)throw new Error('Mock 评论数量不符');
  await page.waitForFunction(()=>{const top=document.querySelector('#food-discussion').getBoundingClientRect().top;return top>=94&&top<=150});
  const xiaolin=page.getByRole('article',{name:'小林的评论',exact:true}),helpful=xiaolin.getByRole('button',{name:'觉得小林的评论有用',exact:true});
  await helpful.click();await page.waitForFunction(()=>{const button=document.querySelector('button[aria-label="觉得小林的评论有用"]');return button?.getAttribute('aria-pressed')==='true'&&button.textContent.includes('47')});
  await page.reload();await page.getByRole('article',{name:'小林的评论',exact:true}).waitFor();if(await helpful.getAttribute('aria-pressed')!=='true')throw new Error('有用状态刷新丢失');await helpful.click();
  await xiaolin.getByRole('button',{name:'查看评论图片 1',exact:true}).click();await page.getByRole('dialog',{name:'评论图片预览',exact:true}).waitFor();await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'最新',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.food-comment')?.getAttribute('aria-label')==='阿圆的评论');
  await page.getByRole('tab',{name:'最新',exact:true}).press('ArrowLeft');await page.waitForFunction(()=>document.querySelector('.food-comment')?.getAttribute('aria-label')==='小林的评论');
  await xiaolin.getByRole('button',{name:'展开全部 3 条回复',exact:true}).click();await xiaolin.getByText('谢谢推荐，明天午饭就试试。',{exact:true}).waitFor();
  await xiaolin.getByRole('button',{name:'回复',exact:true}).click();await page.getByRole('heading',{name:'回复 小林',exact:true}).waitFor();
  const text=page.getByRole('textbox',{name:'写下你的用餐感受',exact:true});await text.fill('本地验收回复：下次加个炸蛋');await text.press('Control+Enter');
  await xiaolin.getByText('本地验收回复：下次加个炸蛋',{exact:true}).waitFor();checks.push('页内定位、点赞持久化、图片预览与 Esc、最有用/最新和键盘排序、展开回复与 Ctrl+Enter 回复');
  await page.locator('input[aria-label="添加评论图片"]').setInputFiles('prototype/assets/photos/sq_luosi.png');await page.getByAltText('待发布图片 1',{exact:true}).waitFor();
  await page.getByRole('button',{name:'移除评论图片 1',exact:true}).click();if(await page.getByAltText('待发布图片 1',{exact:true}).count())throw new Error('附图删除失败');
  await page.locator('input[aria-label="添加评论图片"]').setInputFiles('prototype/assets/photos/sq_luosi.png');await page.getByAltText('待发布图片 1',{exact:true}).waitFor();
  await text.fill('本地验收评论：口味和分量都不错');await page.getByRole('button',{name:'发表评论',exact:true}).dblclick();
  await page.getByText('评论已保存在本地演示中。',{exact:true}).waitFor();if(await page.locator('.food-comment').count()!==4)throw new Error('双击重复创建评论');
  await page.reload();await page.getByText('本地验收评论：口味和分量都不错',{exact:true}).waitFor();
  const post=page.locator('.food-comment').filter({hasText:'本地验收评论：口味和分量都不错'});if(await post.getByRole('button',{name:'查看评论图片 1',exact:true}).count()!==1)throw new Error('评论附图未持久化');
  await page.goto(base+'/foods/1?section=comments');await page.getByRole('article',{name:'小林的评论',exact:true}).waitFor();if(await page.getByText('本地验收评论：口味和分量都不错',{exact:true}).count())throw new Error('评论串到其他菜品');
  await page.goto(base+'/me?tab=comments');await page.getByRole('tab',{name:/评论/}).waitFor();const entry=page.locator('.food-my-comments > a').filter({hasText:'本地验收评论：口味和分量都不错'});await entry.waitFor();await entry.click();await page.waitForURL('**#/foods/4?section=comments');
  checks.push('图文评论同页发表、双击防重、刷新恢复、按菜品隔离、我的评论回到准确菜品');
  await page.goto(base+'/comments?foodId=4');await page.waitForURL('**#/foods/4?section=comments');
  await page.goto(base+'/comments/write?foodId=1');await page.waitForURL('**#/foods/1?section=comments&compose=1');await text.waitFor();await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='写下你的用餐感受');
  await page.goto(base+'/foods/4?section=comments');await page.getByRole('article',{name:'小林的评论',exact:true}).waitFor();
  for(const width of [1024,1280,1440,1920]) {
   await page.setViewportSize({width,height:1000});const layout=await page.evaluate(()=>{const a=document.querySelector('.food-discussion-list').getBoundingClientRect(),b=document.querySelector('.food-comment-composer').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth+1,sideBySide:a.right<b.left,composerWidth:b.width}});
   if(layout.overflow||!layout.sideBySide||layout.composerWidth<270)throw new Error('讨论区 PC 适配失败 '+JSON.stringify({width,...layout}));widths.push({width,...layout});
  }
  await page.setViewportSize({width:760,height:900});await page.waitForFunction(()=>Math.abs(document.querySelector('.pc-app').getBoundingClientRect().width-innerWidth)<1);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('窄屏桌面预览溢出');
  checks.push('旧评论与写评论入口并入详情、四种桌面宽度与 760px 缩放预览');
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173/?demo=1#/foods/4');await page.getByRole('heading',{name:/柳州\s*螺蛳粉/}).waitFor();if(await page.locator('.food-discussion').count())throw new Error('桌面布局影响移动端原型');checks.push('移动端原型详情保留');
  if(errors.length)throw new Error(errors.join('\n'));return {checks,widths,pageErrors:errors,realBackendRequests:0};
 }finally{
  await page.evaluate(value=>value===null?localStorage.removeItem('eatwhat-demo-comments-v1'):localStorage.setItem('eatwhat-demo-comments-v1',value),original);
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/foods/4');page.off('pageerror',onError);
 }
}
