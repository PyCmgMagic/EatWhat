import { version } from "../../package.json";

const rawBuild = import.meta.env.VITE_BUILD_NUMBER;
export const buildNumber =
  rawBuild && /^\d+$/.test(rawBuild) ? Number(rawBuild) : undefined;
export const webVersion = version;
