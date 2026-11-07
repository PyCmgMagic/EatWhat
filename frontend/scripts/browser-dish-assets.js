async (page) => {
  const context=await page.context().browser().newContext({viewport:{width:1040,height:650}});
  const p=await context.newPage();
  try {
    await p.goto('http://127.0.0.1:5173/');
    const dishes=[['yuntun','鲜虾蟹籽云吞'],['jiaozi','玉米鲜肉饺子'],['niunan','番茄牛腩饭'],['yangzhi','杨枝甘露'],['luosifen','柳州螺蛳粉'],['tieguodun','铁锅炖大鹅'],['xiangguo','麻辣香锅'],['niandoubao','粘豆包']];
    await p.setContent(`<html lang="zh-CN"><head><style>body{margin:0;padding:28px;background:#fff;color:#231c18;font-family:system-ui,sans-serif}h1{margin:0 0 20px;font-size:24px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:24px 20px}figure{margin:0;text-align:center}img{width:190px;height:190px}figcaption{font-size:15px;font-weight:600}small{display:block;color:#6e625b;font-weight:400;margin-top:4px}</style></head><body><h1>原型菜品插画</h1><main>${dishes.map(([key,name])=>`<figure><img src="http://127.0.0.1:5173/prototype/assets/dishes/${key}.svg" alt="${name}"><figcaption>${name}<small>${key}.svg</small></figcaption></figure>`).join('')}</main></body></html>`);
    await p.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
    await p.screenshot({path:'output/playwright/dish-illustrations-catalog.png',fullPage:true});
    return {assets:dishes.length};
  }finally{await context.close()}
}
