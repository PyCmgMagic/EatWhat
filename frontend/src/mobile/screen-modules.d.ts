declare module "virtual:eatwhat-screens" {
  export const screenModules: Record<
    string,
    () => Promise<{
      default: {
        title: string;
        css: string;
        tree: import("./types").DesignNode;
      };
    }>
  >;
}
