async function validateDesktopProfile(browserPage) {
  const context = await browserPage.context().browser().newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await context.route(url => url.origin !== 'http://127.0.0.1:5173' || url.pathname.startsWith('/api/'), route => route.abort());
  const selectValue = async (name, value) => {
    const trigger = page.getByRole('combobox', {name, exact:true});
    const label = await trigger.locator('..').locator('select option[value="'+value+'"]').textContent();
    await trigger.click();
    await page.getByRole('option', {name:label, exact:true}).click();
  };
  const base = 'http://127.0.0.1:5173/?demo=1&view=desktop#', checks = [], errors = [], widths = [];
  const onError = e => errors.push(e.message), onDialog = d => d.type() === 'beforeunload' ? d.accept() : d.dismiss();
  page.on('pageerror', onError); page.on('dialog', onDialog);
  await page.goto(base + '/me/edit'); await page.locator('#nick').waitFor();
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('eatwhat-demo-prototype-v3')).user);
  try {
    const name = await page.locator('#nick').inputValue();
    await page.locator('#nick').fill('食'); await page.getByRole('button', {name:'保存修改',exact:true}).click();
    if (await page.locator('#nick').getAttribute('aria-invalid') !== 'true') throw new Error('未校验昵称');
    await page.getByRole('button', {name:'取消修改',exact:true}).click();
    if (await page.locator('#nick').inputValue() !== name) throw new Error('取消未恢复原值');
    await page.locator('#nick').fill('好好吃饭呀'); await page.locator('#sign').fill('今天想吃一碗热汤');
    if (await page.locator('.pc-profile-avatar-picker img').getAttribute('data-default-avatar') !== 'true') throw new Error('缺少默认头像');
    await page.getByRole('button', {name:'返回个人主页',exact:true}).click();
    await page.getByRole('dialog', {name:'还有修改未保存'}).getByRole('button', {name:'继续编辑',exact:true}).click();
    if (await page.locator('#sign').inputValue() !== '今天想吃一碗热汤') throw new Error('返回取消丢失修改');
    checks.push('昵称校验、取消恢复、默认头像预览与返回时保留编辑');
    await page.locator('input[type=file]').setInputFiles('prototype/assets/photos/sq_luosi.png');
    await page.getByRole('dialog', {name:'调整头像'}).waitFor(); await page.keyboard.press('Escape');
    if (await page.getByRole('button', {name:'撤销头像更换',exact:true}).count()) throw new Error('裁剪取消仍修改头像');
    await page.locator('input[type=file]').setInputFiles('prototype/assets/photos/sq_luosi.png');
    await page.getByRole('dialog', {name:'调整头像'}).getByRole('slider').fill('1.25');
    await page.screenshot({path:'output/playwright/pc-profile-crop.png'});
    await page.getByRole('button', {name:'使用这个头像',exact:true}).click();
    await page.getByRole('button', {name:'调整取景',exact:true}).waitFor();
    if (!(await page.getByAltText('头像预览').getAttribute('src')).startsWith('blob:')) throw new Error('没有本地头像预览');
    if (await page.getByRole('combobox', {name:/家乡/}).count()) throw new Error('桌面演示仍显示家乡选项');
    await selectValue('性别','female');
    await page.locator('#profile-birthday').fill('2002-09-14');
    for (const width of [1024,1280,1440,1920]) {
      await page.setViewportSize({width,height:1000}); await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => {
        const card = document.querySelector('.pc-profile-form .pc-secondary-section').getBoundingClientRect(), avatar = document.querySelector('.pc-profile-avatar-row').getBoundingClientRect();
        const controls = Array.from(document.querySelectorAll('.pc-profile-fields input,.pc-profile-fields [role=combobox],.pc-profile-fields textarea'));
        return {overflow:document.documentElement.scrollWidth>innerWidth+1,integrated:avatar.left>=card.left&&avatar.right<=card.right&&avatar.top>=card.top,controlWidths:controls.map(el=>el.getBoundingClientRect().width)};
      });
      if (layout.overflow || !layout.integrated || layout.controlWidths.some(w=>w<200)) throw new Error('宽度适配异常 '+width+' '+JSON.stringify(layout));
      widths.push({width,...layout}); await page.screenshot({path:'output/playwright/pc-profile-'+width+'.png'});
    }
    await page.setViewportSize({width:760,height:900});
    if (await page.evaluate(() => document.documentElement.scrollWidth>innerWidth+1)) throw new Error('窄屏桌面预览溢出');
    await page.screenshot({path:'output/playwright/pc-profile-preview-760.png'});
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button', {name:'保存修改',exact:true}).dblclick();
    await page.getByText('修改已保存，个人主页已同步更新。',{exact:true}).waitFor();
    if (!await page.getByRole('button',{name:'保存修改',exact:true}).isDisabled()) throw new Error('成功后仍是脏状态');
    await page.getByRole('button', {name:'返回个人主页',exact:true}).click();
    await page.getByRole('heading', {name:'好好吃饭呀',exact:true}).waitFor();
    await page.goto(base+'/me/details'); await page.locator('#nick').waitFor();
    if (await page.locator('#sign').inputValue()!=='今天想吃一碗热汤' || await page.locator('#profile-birthday').inputValue()!=='2002-09-14') throw new Error('合并资料未正确回读');
    checks.push('头像就地裁剪和取消、同页完整保存、个人主页与原补充资料入口回读');
    await page.goto('http://127.0.0.1:5173/?demo=1&persona=unverified&view=desktop#/me/edit');
    await page.locator('#nick').waitFor(); checks.push('未认证用户可编辑资料');
    await page.goto('about:blank'); await page.setViewportSize({width:390,height:844}); await page.goto('http://127.0.0.1:5173/?demo=1#/me/edit');
    await page.locator('#nick').waitFor(); await page.getByRole('combobox',{name:'性别，选填',exact:true}).waitFor();
    if (await page.getByRole('combobox', {name:/家乡/}).count()) throw new Error('移动演示仍显示家乡选项');
    if (await page.locator('.pc-profile-editor').count()) throw new Error('移动端误用桌面编辑器');
    checks.push('移动端编辑资料与两端演示的家乡选项检查');
    if(errors.length) throw new Error(errors.join('\n'));
    return {checks,widths,narrowDesktopPreview:760,pageErrors:errors};
  } finally {
    await page.evaluate(user => {const key='eatwhat-demo-prototype-v3',state=JSON.parse(localStorage.getItem(key));state.user=user;localStorage.setItem(key,JSON.stringify(state));},original);
    await context.close();
    page.off('pageerror',onError); page.off('dialog',onDialog);
  }
}
