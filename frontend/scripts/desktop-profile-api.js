async (page) => {
  const base='http://127.0.0.1:5173',checks=[],updates=[],puts=[],calls=[],unexpected=[];
  const user={id:90,displayName:'验收食友',signature:'爱吃热汤面',verified:false,role:'user',birthday:946684800000,gender:'custom'};
  const ok=data=>({code:0,msg:'success',data}); let updateFailure=true, readbackFailure=false;
  const isApi=url=>url.origin===base&&url.pathname.startsWith('/api/');
  const previous=await page.evaluate(()=>localStorage.getItem('eatwhat-session'));
  const onDialog=d=>d.type()==='beforeunload'?d.accept():d.dismiss();page.on('dialog',onDialog);
  await page.route(isApi,async route=>{
    const req=route.request(),path=new URL(req.url()).pathname.slice(4);calls.push(path);let status=200,result=ok(null);
    if(path==='/user/info'){if(readbackFailure){status=503;result={code:503,msg:'验收：读回暂不可用',data:null}}else result=ok(user)}
    else if(path==='/user/userInfo')result=ok(user);
    else if(path==='/user/level')result=ok({level:1});
    else if(path==='/remote-config')result=ok({});
    else if(path==='/campus/list')result=ok([]);
    else if(['/foods/by-user/90','/foods/favorites','/foods/my'].includes(path))result=ok({items:[],totalItems:0});
    else if(path==='/notification/cards/unread/count')result=ok({members:0});
    else if(path==='/device/register')result=ok(null);
    else if(path==='/upload/presign')result=ok({key:'avatar/profile-test.jpg',putUrl:'https://storage.invalid/profile-test.jpg'});
    else if(path==='/upload/complete')result=ok({key:'avatar/profile-test.jpg'});
    else if(path==='/user/updateInfo'){updates.push(req.postDataJSON());if(updateFailure){status=400;result={code:900,msg:'验收：资料暂未保存',data:null}}else Object.assign(user,req.postDataJSON())}
    else{unexpected.push(path);status=404;result={code:404,msg:'未配置：'+path,data:null}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.route('https://storage.invalid/profile-test.jpg',async route=>{if(route.request().method()==='PUT')puts.push(route.request().headers());await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'PUT,OPTIONS','access-control-allow-headers':'content-type'},body:''})});
  try{
    await page.evaluate(()=>localStorage.setItem('eatwhat-session',JSON.stringify({tokenName:'x-profile-test',tokenValue:'isolated-qa'})));
    await page.goto(base+'/?demo=0&view=desktop#/me/edit');await page.locator('#nick').waitFor();
    if(await page.getByRole('combobox',{name:/家乡/}).count())throw new Error('仍显示家乡选项');
    await page.getByText('已设置生日，重新选择可修改，留空会保留。',{exact:true}).waitFor();
    await page.locator('#nick').fill('新的验收食友');await page.locator('#sign').fill('资料接口验收');
    await page.locator('input[type=file]').setInputFiles('prototype/assets/photos/sq_luosi.png');await page.getByRole('button',{name:'使用这个头像',exact:true}).click();
    await page.getByRole('button',{name:'调整取景',exact:true}).waitFor();if(puts.length||updates.length)throw new Error('选择头像提前写入服务端');
    await page.getByRole('button',{name:'保存修改',exact:true}).dblclick();await page.getByText(/验收：资料暂未保存/).waitFor();
    if(updates.length!==1||puts.length!==1)throw new Error('双击重复提交');
    if(Object.keys(updates[0]).sort().join(',')!=='avatar,displayName,signature')throw new Error('提交了未修改的字段：'+JSON.stringify(updates[0]));
    if(puts[0]['x-profile-test']||puts[0].authorization)throw new Error('存储上传泄露会话');
    if(await page.locator('#sign').inputValue()!=='资料接口验收')throw new Error('失败丢失输入');
    updateFailure=false;await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByText('修改已保存，个人主页已同步更新。',{exact:true}).waitFor();
    if(puts.length!==1||updates.length!==2)throw new Error('重试重复上传头像');
    checks.push('头像只在统一保存时上传、双击防重、业务错误保留修改、重试复用 key、存储 PUT 无应用令牌');
    checks.push('时间戳生日与未知性别保留，仅提交发生变化的字段');
    await page.getByRole('combobox',{name:'性别',exact:true}).click();
    await page.getByRole('option',{name:'女',exact:true}).click();
    await page.locator('#profile-birthday').fill('2002-09-14');
    await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByText('修改已保存，个人主页已同步更新。',{exact:true}).waitFor();
    const more=updates.at(-1);if(Object.keys(more).sort().join(',')!=='birthday,gender'||more.gender!=='female'||more.birthday!=='2002-09-14')throw new Error('补充资料请求体异常');
    await page.locator('#sign').fill('');
    await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByText('修改已保存，个人主页已同步更新。',{exact:true}).waitFor();
    const cleared=updates.at(-1);if(Object.keys(cleared).join(',')!=='signature'||cleared.signature!=='')throw new Error('签名未清空');
    checks.push('生日和性别同页保存，签名可清空');
    readbackFailure=true;await page.locator('#sign').fill('已确认保存的签名');await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByText('修改已保存，个人主页已同步更新。',{exact:true}).waitFor();
    if(await page.locator('#sign').inputValue()!=='已确认保存的签名')throw new Error('保存成功后读回失败丢失资料');
    checks.push('更新成功但读回离线时保留已确认修改');
    if(unexpected.length)throw new Error('未配置接口：'+unexpected.join(','));
    return {checks,profileUpdates:updates.length,storagePuts:puts.length,interceptedRequests:calls.length,realBackendRequests:0};
  }finally{
    await page.goto(base+'/?demo=1&view=desktop#/me/edit');
    await page.evaluate(value=>value===null?localStorage.removeItem('eatwhat-session'):localStorage.setItem('eatwhat-session',value),previous);
    await page.unroute(isApi);await page.unroute('https://storage.invalid/profile-test.jpg');page.off('dialog',onDialog);
  }
}
