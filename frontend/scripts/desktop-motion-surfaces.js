async(page)=>{
 const base='http://127.0.0.1:5173/?demo=1&view=desktop#/',checks=[],errors=[],requests=[];
 const error=e=>errors.push(e.message),guard=u=>u.pathname.startsWith('/api/');page.on('pageerror',error);await page.route(guard,r=>{requests.push(r.request().url());return r.abort()});
 const settle=()=>page.evaluate(async()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
 try{
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'search');await page.locator('.ew-food-card').first().waitFor();
  const area=page.getByRole('button',{name:'软件园校区',exact:true});await area.click();await page.getByRole('dialog',{name:'从哪里开始找好吃的？'}).waitFor();await settle();
  const exiting=await page.locator('dialog.modal').evaluate(async e=>{e.querySelector('button[aria-label="关闭弹窗"]').click();await new Promise(r=>requestAnimationFrame(r));return {connected:e.isConnected,inert:e.inert,closing:e.dataset.dismissing,animations:e.getAnimations().length}});
  if(!exiting.connected||!exiting.inert||exiting.closing!=='true'||!exiting.animations)throw new Error('条件弹窗没有保留退出过程 '+JSON.stringify(exiting));
  await page.locator('dialog.modal').waitFor({state:'detached'});await area.click();await page.keyboard.press('Escape');await page.locator('dialog.modal').waitFor({state:'detached'});checks.push('区域弹窗关闭保留遮罩、停用内容、可再次打开与 Escape 关闭');

  await page.goto(base+'me/edit');await page.getByRole('textbox',{name:/昵称/}).fill('动效检查员');
  const back=page.getByRole('button',{name:'返回个人主页',exact:true});
  for(let i=0;i<2;i++){await back.click();await page.getByRole('dialog',{name:'还有修改未保存',exact:true}).waitFor();await page.getByRole('button',{name:'继续编辑',exact:true}).click();await page.locator('.pc-profile-leave').waitFor({state:'detached'})}
  if(await page.getByRole('textbox',{name:/昵称/}).inputValue()!=='动效检查员')throw new Error('取消离开丢失表单');
  await back.click();await page.getByRole('button',{name:'放弃修改并返回',exact:true}).click();checks.push('未保存资料弹窗连续取消、表单保留、主动放弃后返回');

  await page.goto(base+'me/tags');await page.locator('.pc-tag-card').first().waitFor();
  const manage=page.getByRole('button',{name:'管理标签',exact:true});if(await manage.count())await manage.click();
  const remove=page.getByRole('button',{name:/^删除/}).first();
  for(let i=0;i<2;i++){await remove.click();await page.locator('.pc-library-dialog').waitFor();await page.getByRole('button',{name:'保留标签',exact:true}).click();await page.locator('.pc-library-dialog').waitFor({state:'detached'})}
  checks.push('标签删除确认重复打开与取消，标签保留');

  await page.goto(base+'foods/4');await page.locator('.food-comment-images button').first().waitFor();
  for(let i=0;i<2;i++){await page.locator('.food-comment-images button').first().click();await page.getByRole('dialog',{name:'评论图片预览',exact:true}).waitFor();await page.getByRole('button',{name:'关闭评论图片',exact:true}).click();await page.locator('.food-comment-photo-dialog').waitFor({state:'detached'})}
  checks.push('评论图片预览可重复打开与完整退场');
  if(errors.length||requests.length)throw new Error(JSON.stringify({errors,requests}));const result={checks,errors,realBackendRequests:requests.length};await page.evaluate(r=>sessionStorage.setItem('eatwhat-qa-motion-surfaces',JSON.stringify(r)),result);return result;
 }catch(error){await page.screenshot({path:'output/playwright/motion-surfaces-failure.png'});throw error}
 finally{await page.goto(base);await page.unroute(guard);page.off('pageerror',error)}
}
