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
  title: "制作团队",
  back: aboutHome.path,
};

export const aboutPages = [aboutHome, aboutUs, productionTeam];
export function findAboutPage(path: string) {
  return aboutPages.find((page) => page.path === path);
}
