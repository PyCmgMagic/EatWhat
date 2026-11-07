async (page) => {
  const base = 'http://127.0.0.1:5173';
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await context.newPage(), checks = [], errors = [], calls = [];
  const food = {
    id: 1000000245, accountId: 1000000001, name: '招牌牛筋面',
    restaurantId: 1000000141, restaurantName: '汤见17码头',
    description: '免费加面 吃得很爽', category: 'staple', price: 18.9,
    pictureKeys: ['foods/test/noodles.jpg'],
    pictureUrl: ['/prototype/assets/photos/sq_luosi.png'],
    coverCrop: { centerX: 0.5, centerY: 0.4704, diameter: 1 },
    stageColor: 'soy', stageAlternates: ['redoil', 'chili'],
    mealTimes: ['lunch', 'dinner'], isLiked: true, isFavorite: false,
    myCustomTags: [], systemTags: [],
  };
  let format = 'array', items = [food];
  p.setDefaultTimeout(10000);
  p.on('pageerror', error => errors.push(error.message));
  await context.route(url => url.origin !== base, route => route.abort());
  await context.route(url => url.origin === base && url.pathname.startsWith('/api/'), route => {
    const url = new URL(route.request().url());
    let data = null;
    if (url.pathname === '/api/foods/recommend') {
      calls.push(Object.fromEntries(url.searchParams));
      const selected = items.filter(item => !url.searchParams.has('category') || item.category === url.searchParams.get('category'));
      data = format === 'array' ? selected : format === 'page' ? { items: selected, totalItems: selected.length } : { unexpected: selected };
    } else if (url.pathname === '/api/campus/list') data = [{ id: 1, name: '软件园', open: true, isDefault: true }];
    else if (url.pathname === '/api/remote-config') data = { configVersion: 1, flags: {}, params: {}, maintenance: { mode: 'NONE' }, announcements: [], versions: {} };
    return route.fulfill({ status: 200, json: { code: 0, data } });
  });
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const home = () => p.goto(base + '/?demo=0&view=desktop#/');
  const shown = async name => {
    await p.locator(`.pc-hero h1[title="${name}"]`).waitFor();
    await p.locator('.pc-food-grid').getByRole('heading', { name, exact: true }).waitFor();
    await p.waitForFunction(() => {
      const image = document.querySelector('.pc-current-plate img');
      return image && image.complete && image.naturalWidth > 0;
    });
    assert(!await p.getByRole('heading', { name: '这里还没有内容', exact: true }).count(), 'Nonempty recommendations rendered an empty state');
  };
  try {
    await home();
    await shown(food.name);
    await p.locator('.pc-hero-shop').getByText(food.restaurantName, { exact: true }).waitFor();
    assert(await p.locator('.pc-hero-price').innerText() === '¥18.9', 'Price was lost');
    assert(await p.locator('.pc-hero').evaluate(element => element.style.getPropertyValue('--stage')) === '#8F5B24', 'Stage color was lost');
    await p.screenshot({ path: 'output/playwright/home-recommendation-array-desktop.png', fullPage: true });
    checks.push('Deployed data array renders the hero, list, photo, restaurant, price and stage color');

    await p.getByRole('tab', { name: '主食', exact: true }).click();
    await shown(food.name);
    assert(calls.some(query => query.category === 'staple'), 'Category did not reach the API');
    checks.push('Category recommendations also accept data arrays');
    await p.getByRole('tab', { name: '今日推荐', exact: true }).click();
    items = [{ ...food, id: 1000000246, name: '换一批的牛筋面' }];
    await p.getByRole('button', { name: '换一批推荐', exact: true }).click();
    await shown(items[0].name);
    checks.push('Refresh replaces the visible recommendations with the next array response');

    format = 'page';
    items = [food];
    await p.reload();
    await shown(food.name);
    checks.push('Documented data.items page format remains supported');

    format = 'array';
    items = [];
    await p.reload();
    await p.getByRole('heading', { name: '这里还没有内容', exact: true }).waitFor();
    assert(!await p.locator('.pc-hero').count(), 'Empty response left a stale food visible');
    checks.push('Only a valid empty array shows the empty state');

    format = 'invalid';
    await p.reload();
    await p.getByText('推荐数据格式不正确，请稍后重试。', { exact: true }).waitFor();
    assert(!await p.getByRole('heading', { name: '这里还没有内容', exact: true }).count(), 'Malformed response was disguised as an empty result');
    format = 'array';
    items = [food];
    await p.getByRole('button', { name: '再试一次', exact: true }).click();
    await shown(food.name);
    checks.push('Malformed responses show an error; retry restores the recommendations');

    assert(!calls.some(query => query.category === ''), 'All recommendations must omit an empty category filter');
    assert(errors.length === 0, errors.join('\n'));
    return { checks, pageErrors: errors, interceptedRecommendationRequests: calls.length, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({ path: 'output/playwright/home-recommendation-failure.png', fullPage: true });
    throw new Error(JSON.stringify({ checks, error: String(error), calls, text: (await p.locator('body').innerText()).slice(0, 2000), pageErrors: errors }));
  } finally {
    await context.close();
  }
}
