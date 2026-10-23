async (page) => {
  const base='http://127.0.0.1:5173',checks=[],updates=[],puts=[],calls=[],unexpected=[];
  const user={id:90,userName:'验收食友',signature:'爱吃热汤面',verified:false,role:'user',birthday:946684800000,gender:'custom',hometownProvinceId:81,hometownCityId:91};
  const ok=data=>({code:0,msg:'success',data}); let updateFailure=true, dictionaryFailure=true, readbackFailure=false;
  const isApi=url=>url.origin===base&&url.pathname.startsWith('/api/');
  const previous=await page.evaluate(()=>sessionStorage.getItem('eatwhat-session'));
  const onDialog=d=>d.type()==='beforeunload'?d.accept():d.dismiss();page.on('dialog',onDialog);
  await page.route(isApi,async route=>{
    const req=route.request(),path=new URL(req.url()).pathname.slice(4);calls.push(path);let status=200,result=ok(null);
    if(path==='/user/info'){if(readbackFailure){status=503;result={code:503,msg:'验收：读回暂不可用',data:null}}else result=ok(user)}
    else if(path==='/notification/unread/count')result=ok(0);
    else if(path==='/api/location/provinces'){if(dictionaryFailure){status=503;result={code:503,msg:'验收：省份暂不可用',data:null}}else result=ok([{id:81,name:'已有省份'},{id:1,name:'山东省'}])}
    else if(path==='/api/location/provinces/81/cities'){if(dictionaryFailure){status=503;result={code:503,msg:'验收：城市暂不可用',data:null}}else result=ok([{id:91,provinceId:81,name:'已有城市'}])}
    else if(path==='/api/location/provinces/1/cities')result=ok([{id:1,provinceId:1,name:'济南市'},{id:2,provinceId:1,name:'青岛市'}]);
    else if(path==='/upload/presign')result=ok({key:'avatar/profile-test.jpg',putUrl:'https://storage.invalid/profile-test.jpg'});
    else if(path==='/upload/complete')result=ok({key:'avatar/profile-test.jpg'});
    else if(path==='/user/updateInfo'){updates.push(req.postDataJSON());if(updateFailure){status=400;result={code:900,msg:'验收：资料暂未保存',data:null}}else Object.assign(user,req.postDataJSON())}
    else{unexpected.push(path);status=404;result={code:404,msg:'未配置：'+path,data:null}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.route('https://storage.invalid/profile-test.jpg',async route=>{if(route.request().method()==='PUT')puts.push(route.request().headers());await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'PUT,OPTIONS','access-control-allow-headers':'content-type'},body:''})});
  try{
    await page.evaluate(()=>sessionStorage.setItem('eatwhat-session',JSON.stringify({tokenName:'x-profile-test',tokenValue:'isolated-qa'})));
    await page.goto(base+'/?demo=0&view=desktop#/me/edit');await page.locator('#nick').waitFor();
    await page.getByText(/省份列表暂时无法加载/).waitFor(); await page.getByText('已设置生日，重新选择可修改，留空会保留。',{exact:true}).waitFor();
    await page.locator('#nick').fill('新的验收食友');await page.locator('#sign').fill('资料接口验收');
    await page.locator('input[type=file]').setInputFiles('prototype/assets/photos/sq_luosi.png');await page.getByRole('button',{name:'使用这个头像',exact:true}).click();
    await page.getByRole('button',{name:'调整取景',exact:true}).waitFor();if(puts.length||updates.length)throw new Error('选择头像提前写入服务端');
    await page.getByRole('button',{name:'保存修改',exact:true}).dblclick();await page.getByText(/验收：资料暂未保存/).waitFor();
    if(updates.length!==1||puts.length!==1)throw new Error('双击重复提交');
    if(Object.keys(updates[0]).sort().join(',')!=='avatar,signature,userName')throw new Error('无关更新覆盖了生日或家乡：'+JSON.stringify(updates[0]));
    if(puts[0]['x-profile-test']||puts[0].authorization)throw new Error('存储上传泄露会话');
    if(await page.locator('#sign').inputValue()!=='资料接口验收')throw new Error('失败丢失输入');
    updateFailure=false;await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByText('修改已保存，个人主页已同步更新。',{exact:true}).waitFor();
    if(puts.length!==1||updates.length!==2)throw new Error('重试重复上传头像');
    checks.push('头像只在统一保存时上传、双击防重、业务错误保留修改、重试复用 key、存储 PUT 无应用令牌');
    checks.push('时间戳生日与未知性别保留、地区服务失败保留原省市、仅提交发生变化的字段');
    dictionaryFailure=false;await page.getByRole('button',{name:'重新加载',exact:true}).click();await page.locator('#home-province option[value="1"]').waitFor({state:'attached'});
    await page.locator('#home-province').selectOption('1');if(await page.locator('#home-city').inputValue()!=='')throw new Error('换省后沿用旧城市');
    await page.locator('#home-city').selectOption('2');await page.locator('#profile-gender').selectOption('female');await page.locator('#profile-birthday').fill('2002-09-14');
    await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByText('修改已保存，个人主页已同步更新。',{exact:true}).waitFor();
    const more=updates.at(-1);if(more.hometownProvinceId!==1||more.hometownCityId!==2||more.gender!=='female'||more.birthday!=='2002-09-14'||more.avatar)throw new Error('补充资料请求体异常');
    await page.getByRole('button',{name:'清除',exact:true}).click();await page.locator('#home-province').selectOption('');await page.locator('#profile-gender').selectOption('');await page.locator('#sign').fill('');
    await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByText('修改已保存，个人主页已同步更新。',{exact:true}).waitFor();
    const cleared=updates.at(-1);if(cleared.birthday!==null||cleared.hometownProvinceId!==null||cleared.hometownCityId!==null||cleared.gender!==null||cleared.signature!=='')throw new Error('显式清空未保存');
    checks.push('地区失败重试、换省清空旧城市、生日性别省市一次保存、可选字段显式清空');
    readbackFailure=true;await page.locator('#sign').fill('已确认保存的签名');await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.getByText('修改已保存，个人主页已同步更新。',{exact:true}).waitFor();
    if(await page.locator('#sign').inputValue()!=='已确认保存的签名')throw new Error('保存成功后读回失败丢失资料');
    checks.push('更新成功但读回离线时保留已确认修改');
    if(unexpected.length)throw new Error('未配置接口：'+unexpected.join(','));
    return {checks,profileUpdates:updates.length,storagePuts:puts.length,interceptedRequests:calls.length,realBackendRequests:0};
  }finally{
    await page.goto(base+'/?demo=1&view=desktop#/me/edit');
    await page.evaluate(value=>value===null?sessionStorage.removeItem('eatwhat-session'):sessionStorage.setItem('eatwhat-session',value),previous);
    await page.unroute(isApi);await page.unroute('https://storage.invalid/profile-test.jpg');page.off('dialog',onDialog);
  }
}
