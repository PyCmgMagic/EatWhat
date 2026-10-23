async (page) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5173/?demo=1&view=desktop#/foods/4');
  await page.getByRole('article', { name: '小林的评论', exact: true }).waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
    await new Promise(requestAnimationFrame);
  });
  await page.screenshot({ path: 'output/playwright/pc-dish-with-comments.png', fullPage: true });
  await page.getByRole('link', { name: '食友讨论', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#food-discussion').getBoundingClientRect().top < 150);
  await page.screenshot({ path: 'output/playwright/pc-dish-discussion.png' });
  return { foodId: 4, screenshots: ['pc-dish-with-comments.png', 'pc-dish-discussion.png'] };
}
