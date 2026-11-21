export const aboutHome = {
  path: "/settings/about",
  title: "关于",
  back: "/settings",
};

export const aboutUs = {
  path: "/settings/about/us",
  title: "关于我们",
  back: aboutHome.path,
};

export const productionTeam = {
  path: "/settings/about/team",
  title: "开发团队",
  back: aboutHome.path,
};

export const openSource = {
  path: "/settings/about/licenses",
  title: "开源声明",
  back: aboutHome.path,
};

export const aboutPages = [aboutHome, aboutUs, productionTeam, openSource];
export function findAboutPage(path: string) {
  return aboutPages.find((page) => page.path === path);
}
