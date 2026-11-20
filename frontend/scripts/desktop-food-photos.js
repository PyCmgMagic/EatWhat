async (page) => {
  const base='http://127.0.0.1:5173/?demo=1&view=desktop#', errors=[], checks=[], widths=[];
  const onError=e=>errors.push(e.message);page.on('pageerror',onError);
  await page.goto(base+'/me');await page.locator('.pc-food-card').first().waitFor();
  const original=await page.evaluate(()=>({foods:JSON.parse(localStorage.getItem('eatwhat-demo-prototype-v3')).foods,colors:localStorage.getItem('eatwhat-stage-colors')}));
  try {
    const id=await page.evaluate(()=>{
      const key='eatwhat-demo-prototype-v3',state=JSON.parse(localStorage.getItem(key)),id=Date.now(),source=state.foods.find(f=>f.accountId===10);
      state.foods.unshift({...source,id, name:'图片展示验收', pictureUrl:['/prototype/assets/photos/sq_luosi.png'],category:'staple'}, {...source,id:id+1,name:'鲜虾蟹籽云吞',pictureUrl:['/prototype/assets/photos/sq_tieguo.png']});
      localStorage.setItem(key,JSON.stringify(state));
      const colors=JSON.parse(localStorage.getItem('eatwhat-stage-colors')||'{}');colors['/prototype/assets/photos/sq_luosi.png']='#C9442B';localStorage.setItem('eatwhat-stage-colors',JSON.stringify(colors));return id;
    });
    await page.reload();await page.locator('.pc-food-card').filter({has:page.getByRole('heading',{name:'图片展示验收',exact:true})}).waitFor();
    await page.mouse.move(0,0);
    for(const width of [1024,1280,1440,1920]) {
      await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
      const data=await page.evaluate(()=>{
        const cards=[...document.querySelectorAll('.pc-food-card')].slice(0,3);
        return {overflow:document.documentElement.scrollWidth>innerWidth+1,cards:cards.map(card=>{
          const tile=card.querySelector('.pc-food-card-image'),plate=tile.querySelector('.pc-plate'),img=plate.querySelector('img'),a=tile.getBoundingClientRect(),b=plate.getBoundingClientRect(),style=getComputedStyle(plate);
          return {name:card.querySelector('h3').textContent,photo:plate.classList.contains('is-photo'),width:b.width,height:b.height,right:a.right-b.right,bottom:a.bottom-b.bottom,radius:style.borderRadius,border:parseFloat(style.borderWidth),fit:getComputedStyle(img).objectFit,tile:getComputedStyle(tile).backgroundColor};
        })};
      });
      if(data.overflow||!data.cards[0].photo||!data.cards[1].photo||data.cards[2].photo)throw new Error('图片类型或布局错误 '+JSON.stringify(data));
      const [photo,,defaultCard]=data.cards;
      if(Math.abs(photo.width-photo.height)>.5||Math.abs(photo.width-defaultCard.width)>.5||Math.abs(photo.right-defaultCard.right)>.5||Math.abs(photo.bottom-defaultCard.bottom)>.5||photo.radius!=='50%'||photo.border<=0||photo.fit!=='cover')throw new Error('上传图没有采用相同圆盘尺寸和位置 '+JSON.stringify(data));
      if(photo.tile!=='rgb(246, 221, 211)')throw new Error('发布舞台色未用于卡片底色');
      widths.push({width,photoDiameter:photo.width,defaultDiameter:defaultCard.width});
      if(width===1440)await page.screenshot({path:'output/playwright/pc-food-photo-cards.png'});
    }
    checks.push('四种桌面宽度：上传图与默认图圆盘尺寸、位置一致，圆形白边，卡片底色跟随舞台色');
    checks.push('与默认菜品重名的上传照片仍按真实照片展示');
    await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/');await page.locator('.pc-current-plate.is-photo img[alt="图片展示验收"]').waitFor();
    await page.getByRole('link',{name:'就它了',exact:true}).click();await page.waitForURL('**#/foods/'+id);await page.locator('.pc-dish-photo.is-photo').waitFor();
    const roundPhoto=await page.locator('.pc-dish-photo').evaluate(el=>getComputedStyle(el).borderRadius==='50%' && getComputedStyle(el.querySelector('img')).objectFit==='cover');
    if(!roundPhoto)throw new Error('详情照片未填满圆盘');
    await page.screenshot({path:'output/playwright/pc-food-photo-detail.png'});checks.push('推荐与详情都使用圆盘展示实拍');
    await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173/?demo=1#/me');
    const mobileCard=page.locator('.design-food-tile').filter({has:page.getByRole('heading',{name:'图片展示验收',exact:true})});await mobileCard.waitFor();
    const mobile=await mobileCard.locator('img').evaluate(img=>({radius:getComputedStyle(img).borderRadius,fit:getComputedStyle(img).objectFit,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height}));
    if(mobile.radius!=='50%'||mobile.fit!=='cover'||mobile.width!==mobile.height)throw new Error('移动端未统一照片样式');
    await page.screenshot({path:'output/playwright/mobile-food-photo-cards.png'});checks.push('移动端上传列表同样为圆盘照片');
    if(errors.length)throw new Error(errors.join('\n'));
    return {checks,widths,pageErrors:errors,realBackendRequests:0};
  } finally {
    await page.evaluate(original=>{const key='eatwhat-demo-prototype-v3',state=JSON.parse(localStorage.getItem(key));state.foods=original.foods;localStorage.setItem(key,JSON.stringify(state));if(original.colors===null)localStorage.removeItem('eatwhat-stage-colors');else localStorage.setItem('eatwhat-stage-colors',original.colors);},original);
    await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/me');page.off('pageerror',onError);
  }
}
