async(page)=>{
 await page.goto('http://127.0.0.1:5173/?demo=1');
 const result=await page.evaluate(()=>{const key='eatwhat-demo-prototype-v3',raw=localStorage.getItem(key);if(!raw)return {removed:0};const data=JSON.parse(raw),before=data.foods.length;data.foods=data.foods.filter(f=>f.name!=='验收测试菜');data.tags=data.tags.filter(t=>!/^测试标签\d{4}改?$/.test(t.name));localStorage.setItem(key,JSON.stringify(data));return {removed:before-data.foods.length,remainingFoods:data.foods.length}});
 await page.reload();return result;
}
