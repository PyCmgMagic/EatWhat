import { execFileSync } from "node:child_process";

/** A merge into main advances the patch once, regardless of the size of the branch. */
export function resolveWebVersion(
  directory: string,
  base: { version: string; versionBaseCommit: string },
  requireHistory: boolean,
): string {
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }).trim();

  const { version, versionBaseCommit } = base;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Web 版本基准必须是三段数字：${version}`);
  }
  const [major, minor, patch] = version.split(".");
  try {
    const distance = git(
      "rev-list",
      "--first-parent",
      "--count",
      versionBaseCommit + "..HEAD",
    );
    if (
      git("rev-parse", "--verify", "HEAD~" + distance) !== versionBaseCommit
    ) {
      throw new Error("当前提交的主线历史不包含版本基准提交");
    }
    return `${major}.${minor}.${Number(patch) + Number(distance)}`;
  } catch (cause) {
    if (requireHistory) {
      throw new Error("无法从 Git 历史计算 Web 发布版本号", { cause });
    }
    return version + "-local";
  }
}
