async(page)=>{
 const paths=['/','/home-photo','/nearby','/me','/notifications','/foods/1','/restaurants/1','/publish','/publish/dish','/restaurants/new','/auth','/auth/password','/auth/register','/auth/register/confirm','/auth/forgot','/data-notice','/verify','/search','/topics','/topics/current','/comments','/comments/write','/restaurants/correction','/users/21','/follows','/me/edit','/me/tags','/favorites','/history','/settings','/settings/account','/settings/phone','/settings/password','/settings/devices','/settings/delete','/settings/privacy','/settings/blocked','/settings/notifications','/settings/about','/feedback','/publish/crop','/panels/place','/panels/filter','/panels/tags','/panels/report','/me/details','/settings/bind-phone','/auth/username-register','/restaurants/new/details'];
 const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text())});
 await page.setViewportSize({width:390,height:844});
 for(const path of paths){await page.goto('http://127.0.0.1:5173/?demo=1#'+path);await page.locator('#root').waitFor();await page.evaluate(()=>document.fonts.ready);if(await page.evaluate(()=>document.body.innerText.includes('{{')))throw new Error('Unresolved '+path);}
 const sizes=[{width:320,height:568},{width:360,height:740},{width:390,height:667},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1440,height:1000}];
 for(const size of sizes){await page.setViewportSize(size);await page.goto('http://127.0.0.1:5173/?demo=1');await page.getByRole('heading',{name:'鲜虾蟹籽 云吞'}).waitFor();await page.evaluate(()=>document.fonts.ready);
  const rect=await page.getByRole('navigation',{name:'主导航'}).boundingBox();if(!rect||rect.x<0||rect.x+rect.width>size.width+1||rect.y+rect.height>size.height+1)throw new Error('Nav outside '+JSON.stringify(size));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Horizontal overflow '+JSON.stringify(size));
  await page.screenshot({path:'output/prototype/responsive-'+size.width+'x'+size.height+'.png'});
 }
 await page.goto('http://127.0.0.1:5173/?demo=1&persona=unverified#/favorites');await page.getByRole('heading',{name:'先完成学生认证',exact:true}).waitFor();
 await page.goto('http://127.0.0.1:5173/?demo=1&persona=admin#/admin');await page.getByRole('button',{name:'餐厅维护',exact:true}).waitFor();await page.getByRole('button',{name:'餐厅维护',exact:true}).click();await page.getByRole('table').waitFor();
 await page.goto('http://127.0.0.1:5173/?demo=1#/admin');await page.getByRole('heading',{name:'这里需要管理员身份',exact:true}).waitFor();
 if(errors.length)throw new Error(errors.join('\n'));return {routes:paths.length,responsive:sizes,errors,warnings:[...new Set(warnings)],guardChecks:['verified','admin','normal-user']};
}
