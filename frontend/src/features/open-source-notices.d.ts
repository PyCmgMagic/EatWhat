declare module "virtual:open-source-notices" {
  const notices: {
    name: string;
    version: string;
    license?: string;
    text: string;
  }[];
  export default notices;
}
