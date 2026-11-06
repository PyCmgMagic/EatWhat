async (page) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:5173/?demo=1#/features');
  await page.getByRole('heading',{name:'更多功能',exact:true}).waitFor();
  await page.screenshot({path:'D:/项目/EatWhat/output/playwright/api-v4-features-desktop.png',fullPage:true});
  console.log(await page.locator('main').innerText());
}
