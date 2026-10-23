async(page)=>{
 const origin='http://127.0.0.1:5173/?demo=1#',checks=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/me/edit');await page.locator('#nick').waitFor();
 const name=await page.locator('#nick').inputValue(),sign=await page.locator('#sign').inputValue();
 await page.locator('#nick').fill('测试同学');await page.locator('#sign').fill('资料更新验收');
 await page.getByRole('link',{name:'保存',exact:true}).click();
 await page.getByRole('heading',{name:'测试同学',exact:true}).waitFor();
 await page.getByText('资料更新验收',{exact:true}).waitFor();
 await page.goto(origin+'/me/edit');await page.locator('#nick').waitFor();
 await page.locator('#nick').fill(name);await page.locator('#sign').fill(sign);await page.getByRole('link',{name:'保存',exact:true}).click();
 await page.getByRole('heading',{name,exact:true}).waitFor();checks.push('昵称签名保存、刷新回显、恢复原资料');
 await page.goto(origin+'/settings/privacy');
 const toggle=page.getByRole('switch',{name:'公开我的关注列表',exact:true});await toggle.waitFor();
 const before=await toggle.getAttribute('aria-checked');await toggle.click();
 await page.waitForFunction(value=>document.querySelector('[aria-labelledby="following"]')?.getAttribute('aria-checked')!==value,before);
 await toggle.click();checks.push('隐私开关请求及回显');
 await page.goto(origin+'/settings/password');await page.locator('#old-pwd').fill('demo-old');await page.locator('#new-pwd').fill('demo-new-password');
 await page.getByRole('button',{name:'改好了',exact:true}).click();await page.getByRole('heading',{name:'密码改好了',exact:true}).waitFor();checks.push('修改密码通过接口成功后展示完成态');
 await page.goto(origin+'/me');await page.getByRole('heading',{name,exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'output/prototype/app-me.png'});
 await page.goto(origin+'/search');await page.getByRole('searchbox').fill('袁记');await page.getByRole('link').filter({hasText:'袁记云饺'}).waitFor();checks.push('真实列表的店名搜索');
 await page.goto(origin+'/settings/devices');await page.getByRole('heading').filter({hasText:'登录设备'}).waitFor();
 if(await page.getByText('iPhone 15',{exact:false}).count())throw new Error('Unsupported devices rendered as real sessions');checks.push('未支持设备管理不伪造数据');
 await page.goto(origin+'/me/tags');
 await page.getByRole('button',{name:'管理',exact:true}).click();
 const leftovers=page.locator('li').filter({hasText:'测试标签'});
 while(await leftovers.count()){const text=await leftovers.first().innerText();await leftovers.first().getByRole('button',{name:'删除',exact:true}).click();await page.getByRole('button',{name:'删除分类',exact:true}).click();await page.locator('li').filter({hasText:text}).waitFor({state:'detached'});}
 if(errors.length)throw new Error(errors.join('\n'));
 return {checks,errors};
}
