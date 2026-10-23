async(page)=>{
 const names=["G-AddDish", "G-Blocked", "G-ChangePassword", "G-ChangePhone", "G-Comments", "G-Crop", "G-DataNotice", "G-DeleteAccount", "G-Detail", "G-Devices", "G-Dish", "G-EditProfile", "G-Feedback", "G-Follows", "G-ForgotPassword", "G-History", "G-HomePhoto", "G-Icon", "G-Icons", "G-Inbox", "G-Kit", "G-Login", "G-Me", "G-MyTags", "G-Nav", "G-Nearby", "G-NewShop", "G-PanelFilter", "G-PanelPlace", "G-PanelReport", "G-PanelTag", "G-PasswordLogin", "G-PhoneLogin", "G-PhotoPipeline", "G-PickShop", "G-Reconsent", "G-RegisterConfirm", "G-Search", "G-Settings", "G-SettingsAbout", "G-SettingsAccount", "G-SettingsNotify", "G-SettingsPrivacy", "G-TagDishes", "G-Topic", "G-TopicArchive", "G-UserProfile", "G-Verify", "G-WriteComment", "G-WrongInfo", "G2-Home"],errors=[],warnings=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push(m.text())});
 await page.setViewportSize({width:390,height:844});
 const checked=[];
 for(const name of names){
  await page.goto('http://127.0.0.1:5173/?demo=1#/reference/'+name);
  await page.locator('[data-screen="'+name+'"]').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const state=await page.evaluate(()=>({unresolved:document.body.innerText.includes('{{'),broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0&&i.getAttribute('src')).map(i=>i.getAttribute('src'))}));
  if(state.unresolved)throw new Error('Unresolved design binding: '+name);
  if(state.broken.length)throw new Error(name+' broken asset '+state.broken.join(','));
  if(['G2-Home','G-Dish','G-Detail','G-Me','G-Nearby','G-AddDish','G-Login','G-Settings','G-PanelTag','G-PanelPlace'].includes(name))await page.screenshot({path:'output/prototype/reference-'+name+'.png',scale:'css'});
  checked.push(name);
 }
 page.off('pageerror',onError);
 if(errors.length)throw new Error(errors.join('\n'));
 return {artboards:checked.length,pageErrors:errors,warnings:[...new Set(warnings)].slice(0,10)};
}