async (page) => {
  const browser = page.context().browser(), engine = browser.browserType().name();
  const base = "http://127.0.0.1:5173", checks = [];
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  for (const width of [320, 390, 820, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const p = await context.newPage(), requests = [], errors = [];
    p.setDefaultTimeout(10000);
    p.on("pageerror", error => { if (!error.message.includes("ResizeObserver loop")) errors.push(error.message); });
    const user = { id: 21, displayName: "测试食友", userName: null, hasUsername: false, hasPassword: false, mobile: "13800000000", verified: false, banned: false, role: "user" };
    await context.route(url => url.origin !== base, route => route.abort());
    await context.route(url => url.origin === base && url.pathname.startsWith("/api/"), route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      const body = request.postData() ? request.postDataJSON() : null;
      requests.push({path,method:request.method(),body});
      const reply = data => route.fulfill({json:{code:0,data}});
      if (path === "/api/auth/register") return route.fulfill({json:{code:30014,msg:"请使用手机号验证码注册"}});
      if (path === "/api/auth/captcha/config") return reply({enabled:false});
      if (path === "/api/auth/phone/code") return reply(null);
      if (["/api/auth/phone/login", "/api/auth/login"].includes(path))
        return reply({isLogin:true,tokenName:"x-registration-test",tokenValue:"isolated-registration-session",newUser:path.endsWith("phone/login")});
      if (path === "/api/user/info") return reply(user);
      if (path === "/api/campus/list") return reply([{id:1,name:"软件园",open:true,isDefault:true}]);
      if (path === "/api/remote-config") return reply({configVersion:1,flags:{},params:{},maintenance:{mode:"NONE"},announcements:[],versions:{}});
      if (path === "/api/foods/detail/91") return reply({id:91,name:"测试菜品",restaurantId:1,restaurantName:"测试餐厅",category:"staple",price:12,pictureUrl:["/prototype/assets/photos/sq_luosi.png"],user:{id:31,displayName:"食友"},isFavorite:false,isLiked:false,systemTags:[]});
      if (path === "/api/restaurant/detail/1") return reply({id:1,name:"测试餐厅",address:"软件园"});
      return reply([]);
    });
    const visit = path => p.goto(base+"/?demo=0#"+path);
    const signedOut = async () => {
      await p.evaluate(() => localStorage.setItem("eatwhat-session", "null"));
      await p.reload();
    };
    const clean = async () => {
      assert(await p.locator('a[href*="/auth/username-register"],input[name="confirm"]').count() === 0, "Username registration remains reachable");
      assert(!requests.some(r => r.path === "/api/auth/register" || r.path === "/api/auth/checkUsername"), "Username registration API was called");
      assert(!await p.evaluate(() => document.documentElement.scrollWidth > innerWidth+1), "Auth page overflows the screen");
    };
    const phoneForm = async (root = p) => {
      await root.getByLabel("登录手机号", {exact:true}).waitFor();
      assert(await root.locator('input[name="username"],input[type="password"]').count() === 0, "Phone registration rendered a password or username form");
      await clean();
    };
    const submitPhone = async (root = p) => {
      await root.getByLabel("登录手机号", {exact:true}).fill("13800000000");
      await root.getByRole("button", {name:"获取验证码",exact:true}).click();
      await root.getByRole("button", {name:/s 后重发/}).waitFor();
      await root.getByLabel("登录验证码", {exact:true}).fill("123456");
      await root.getByRole("button", {name:"登录 / 注册",exact:true}).click();
    };
    try {
      // All current registration links use SMS and retain the protected destination.
      await visit("/auth/password?next=%2Fsettings%2Fpassword");
      await p.locator('input[name="username"]').waitFor();
      await clean();
      await p.getByRole("link", {name:width<600?"注册":"手机号注册",exact:true}).click();
      await phoneForm();
      assert(p.url().endsWith("#/auth/register?next=%2Fsettings%2Fpassword"), "Register entry lost its next destination");

      // Old bookmarks, including a trailing slash, never show the old form.
      await visit("/auth/username-register/?next=%2Fsettings%2Fpassword");
      await p.waitForURL("**#/auth/register?next=%2Fsettings%2Fpassword");
      await phoneForm();
      await submitPhone();
      await p.waitForURL("**#/settings/password");
      assert(requests.some(r => r.path === "/api/auth/phone/login" && r.body.mobile === "13800000000" && r.body.code === "123456" && !r.body.userName), "SMS registration sent the wrong request");
      checks.push(`${width}px: registration entry, legacy redirect, SMS submit and next destination`);

      // Setting a login name happens only after a successful phone registration.
      await signedOut();
      await visit("/auth/register");
      await phoneForm();
      await submitPhone();
      await p.waitForURL("**#/settings/username?first=1");
      assert(await p.evaluate(() => !!JSON.parse(localStorage.getItem("eatwhat-session"))?.tokenValue), "Login-name setup appeared before SMS authentication");
      checks.push(`${width}px: optional login-name setup follows an authenticated phone signup`);

      if (width >= 600) {
        await signedOut();
        await visit("/foods/91?section=comments");
        await p.getByRole("heading", {name:"测试菜品",exact:true}).waitFor();
        await p.locator(".pc-header-actions").getByRole("link", {name:"登录",exact:true}).click();
        const dialog = p.getByRole("dialog", {name:"登录 / 注册",exact:true});
        await dialog.waitFor();
        const originalUrl = p.url();
        await dialog.getByRole("link", {name:"注册账号",exact:true}).click();
        await phoneForm(dialog);
        assert(p.url() === originalUrl, "Switching registration left the active page");
        await submitPhone(dialog);
        await dialog.waitFor({state:"hidden"});
        assert(p.url() === originalUrl, "Modal signup lost the active destination");
        checks.push(`${width}px: desktop dialog registers via SMS and returns to the original page`);
      }

      // Existing username accounts still use password login.
      await signedOut();
      await visit("/auth/password");
      await p.locator('input[name="username"]').fill("ExistingUser");
      await p.locator('input[name="password"]').fill("test-password");
      await p.locator("form").getByRole("button", {name:"登录",exact:true}).click();
      await p.waitForFunction(() => !!JSON.parse(localStorage.getItem("eatwhat-session"))?.tokenValue);
      assert(requests.some(r => r.path === "/api/auth/login" && r.body.userName === "ExistingUser"), "Existing username login was removed");
      await clean();
      assert(errors.length===0, errors.join("\n"));
      checks.push(`${width}px: existing username/password login remains available`);
    } catch (error) {
      await p.screenshot({path:`output/playwright/phone-registration-${engine}-${width}-failure.png`});
      throw error;
    } finally { await context.close(); }
  }
  return {engine,checks,realBackendRequests:0,realSmsMessages:0};
}
