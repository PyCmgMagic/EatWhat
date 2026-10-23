async (page) => {
 const base='http://127.0.0.1:5173/?demo=1&view=desktop#',results=[];
 await page.setViewportSize({width:1440,height:1000});
 const paths=['/','/me/edit','/me/tags','/history','/notifications','/verify','/settings/account','/settings/password','/settings/privacy','/settings/bind-phone','/users/21','/follows','/restaurants/new','/restaurants/new/details','/settings/about','/data-notice','/auth','/auth/password','/auth/username-register','/auth/consent','/auth/register','/auth/register/confirm','/auth/forgot','/settings/phone','/settings/devices','/settings/delete','/settings/blocked','/settings/notifications','/feedback','/restaurants/correction','/topics','/topics/current'];
 for(const path of paths){
  await page.goto(base+path);await page.locator('.pc-header').waitFor();
  const state=await page.evaluate(()=>{const source=document.querySelector('.pc-source-page');return {sourceScreen:source?.getAttribute('data-pc-screen')??null,treatment:!source?'native-desktop':source.classList.contains('pc-auth-layout')?'auth-shell-with-shared-form':'shared-mobile-content',overflow:document.documentElement.scrollWidth>innerWidth+1}});
  results.push({path,...state});
 }
 await page.goto(base+'/notifications');await page.locator('[data-pc-secondary="notifications"]').waitFor();await page.screenshot({path:'output/playwright/pc-audit-notifications.png'});
 await page.goto(base+'/settings/privacy');await page.getByRole('switch').first().waitFor();await page.screenshot({path:'output/playwright/pc-audit-privacy.png'});
 await page.goto(base+'/users/21');await page.locator('.pc-secondary-user-card').waitFor();await page.screenshot({path:'output/playwright/pc-audit-user.png'});
 await page.goto(base+'/me/edit');
 return {checked:results.length,results};
}
