async function validateDesktopSettingsCompact(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error("请在本地开发页面运行");
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" });
  const p = await context.newPage(), checks = [], errors = [], writes = [];
  p.setDefaultTimeout(10000);
  let user = { id: 10, displayName: "测试同学", verified: true, banned: false, role: "user", hasUsername: true, userName: "campus_foodie", hasPassword: true, phone: "13812345678" };
  p.on("pageerror", error => errors.push(error.message));
  await context.addInitScript(() => localStorage.setItem("eatwhat-session", JSON.stringify({tokenName:"x-session",tokenValue:"isolated-pc-settings"})));
  await context.route("**/*", route => {
    const req=route.request(), url=new URL(req.url()), path=url.pathname;
    if(url.origin!==base) return route.abort();
    if(!path.startsWith("/api/")) return route.continue();
    let data=[];
    if(path==="/api/user/info") data=user;
    else if(path==="/api/user/userInfo") data={...user,fansVisible:true,followingsVisible:true};
    else if(path==="/api/campus/list") data=[{id:1,name:"软件园",open:true,isDefault:true}];
    else if(path==="/api/remote-config") data={configVersion:1,flags:{},params:{},maintenance:{mode:"NONE"},announcements:[],versions:{}};
    else if(path==="/api/user/activity") data={firstUseToday:false,experienceAdded:0};
    else if(path==="/api/user/personalization") data={enabled:true};
    else if(path==="/api/notification/cards/unread/count") data={cards:0,members:0};
    if(req.method()!=="GET" && !["/api/device/register","/api/user/activity"].includes(path)) writes.push(path);
    return route.fulfill({status:200,json:{code:0,data}});
  });
  const assert=(ok,message)=>{if(!ok) throw new Error(message);};
  async function home(){
    await p.goto(base+"/?demo=0&view=desktop#/settings");
    await p.getByRole("heading",{name:user.displayName,exact:true}).waitFor();
    await p.getByRole("region",{name:"设置内容"}).getByRole("heading",{name:"设置总览"}).waitFor();
    await p.evaluate(()=>document.fonts.ready);
  }
  try {
    for(const width of [640,820,1024,1440,1920]){
      await p.setViewportSize({width,height:960}); await home();
      const menu=p.getByRole("navigation",{name:"设置导航",exact:true});
      const hrefs=await menu.locator("a").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("href")));
      assert(hrefs.join("|")==="#/settings|#/settings/account|#/settings/personalization|#/settings/privacy|#/help|#/settings/about","Duplicate or missing settings categories");
      assert(await p.locator(".settings-home-status,.settings-home-verification,.settings-home-copy small").count()===0,"Repeated status or explanatory text remains");
      const layout=await p.locator(".pc-settings-workspace").evaluate(root=>({overflow:document.documentElement.scrollWidth>innerWidth+1, small:[...root.querySelectorAll("a,button")].some(el=>el.getBoundingClientRect().height<44)}));
      assert(!layout.overflow&&!layout.small,"Overflow or small target at "+width);
      if(width===1440) await p.screenshot({path:"output/playwright/pc-settings-compact.png",fullPage:true});
      checks.push(width+"px: five categories, 44px targets, no overflow or repeated account shortcuts");
    }
    await p.setViewportSize({width:1440,height:960}); await home();
    await p.getByRole("button",{name:"退出登录",exact:true}).click();
    const dialog=p.getByRole("dialog",{name:"退出当前账号？",exact:true});
    await dialog.waitFor(); await dialog.getByRole("button",{name:"取消",exact:true}).click(); await dialog.waitFor({state:"detached"});
    await p.getByRole("button",{name:"退出登录",exact:true}).click(); await dialog.waitFor(); await p.keyboard.press("Escape"); await dialog.waitFor({state:"detached"});
    assert(await p.getByRole("button",{name:"退出登录",exact:true}).evaluate(el=>document.activeElement===el),"Logout does not restore focus");
    checks.push("Logout confirmation, cancel, Escape and focus restoration preserved");
    const menu=p.getByRole("navigation",{name:"设置导航",exact:true});
    await menu.getByRole("link",{name:"账号与安全",exact:true}).click();
    await p.locator(".pc-settings-account").waitFor();
    assert(await p.locator(".pc-settings-account .pc-secondary-row").count()===6,"Missing account controls");
    assert(await p.locator(".pc-settings-account .pc-secondary-identity").count()===0,"Duplicate profile card remains");
    await p.getByText("138****5678",{exact:true}).waitFor();
    await p.screenshot({path:"output/playwright/pc-account-compact.png",fullPage:true});
    user={...user,hasUsername:false,userName:"",hasPassword:false,phone:"",verified:false};
    await p.reload();
    const account=p.locator(".pc-settings-account"); await account.getByRole("link",{name:"去认证",exact:true}).waitFor();
    assert(await account.locator('a[href="#/settings/username"]').count()===1&&await account.locator('a[href="#/settings/bind-phone"]').count()===1,"Unset account actions are missing");
    assert(await account.locator('a[href="#/settings/password"]').innerText()==="去设置","Unset password has the wrong action");
    checks.push("Account detail: six rows, masked phone, unset username/password and unverified state");
    await menu.getByRole("link",{name:"隐私设置"}).click();
    await p.getByRole("button",{name:"屏蔽名单",exact:true}).waitFor();
    await p.getByRole("link",{name:"使用统计授权",exact:true}).waitFor();
    await menu.getByRole("link",{name:"帮助与反馈"}).click();
    await p.getByRole("searchbox",{name:"搜索使用帮助"}).fill("收藏");
    await p.getByRole("link",{name:"返回设置",exact:true}).waitFor();
    const helpTabs = p.getByRole("navigation", {name:"帮助与反馈",exact:true});
    await helpTabs.getByRole("link",{name:"提交反馈"}).click();
    const draft = p.getByRole("textbox",{name:/反馈内容/});
    await draft.fill("检查切换设置时保留反馈草稿");
    await menu.getByRole("link",{name:"个性化"}).click();
    await p.getByRole("radio",{name:"深色",exact:true}).check();
    await p.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await menu.getByRole("link",{name:"帮助与反馈"}).click();
    await helpTabs.getByRole("link",{name:"提交反馈"}).click();
    assert(await draft.inputValue()==="检查切换设置时保留反馈草稿","Settings navigation discarded the feedback draft");
    checks.push("Appearance and unsent feedback survive category changes");
    await menu.getByRole("link",{name:"关于",exact:true}).click();
    const about=p.getByRole("navigation",{name:"关于栏目"});
    await about.getByRole("link",{name:"制作团队",exact:true}).click();
    await p.getByRole("heading",{name:"制作团队",level:1}).waitFor();
    assert(await menu.getByRole("link",{name:"关于",exact:true}).getAttribute("aria-current")==="location","Team lost its parent selection");
    await p.getByRole("link",{name:"返回关于",exact:true}).click();
    await about.getByRole("link",{name:"关于我们",exact:true}).click();
    await p.getByRole("link",{name:"数据存放说明",exact:true}).waitFor();
    checks.push("Privacy retains blocks and statistics authorization; About retains data notice");
    assert(!errors.length&&!writes.length,JSON.stringify({errors,writes}));
    return {checks,errors,realBackendWrites:0};
  } catch(error) {
    await p.screenshot({path:"output/playwright/pc-settings-compact-failure.png",fullPage:true}); throw error;
  } finally {await context.close();}
}
