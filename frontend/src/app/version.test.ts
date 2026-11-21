import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { resolveWebVersion } from "../../config/web-version";

it("counts an entire merge once and gives rebuilds the same version", () => {
  const directory = mkdtempSync(join(tmpdir(), "eatwhat-version-"));
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgSign=false",
        "-c",
        "core.hooksPath=unused-hooks",
        ...args,
      ],
      { cwd: directory, encoding: "utf8", windowsHide: true },
    ).trim();
  const commit = (message: string) =>
    git("commit", "--allow-empty", "-qm", message);
  try {
    git("init", "-q", "-b", "main");
    commit("base");
    const base = {
      version: "0.1.0",
      versionBaseCommit: git("rev-parse", "HEAD"),
    };
    const version = () => resolveWebVersion(directory, base, true);
    expect(version()).toBe("0.1.0");

    git("checkout", "-qb", "feature");
    commit("one");
    commit("two");
    git("checkout", "-q", "main");
    git("merge", "--no-ff", "-qm", "feature merge", "feature");
    expect(version()).toBe("0.1.1");
    expect(version()).toBe("0.1.1");
    commit("next release");
    expect(version()).toBe("0.1.2");

    const missingBase = { ...base, versionBaseCommit: "0".repeat(40) };
    expect(resolveWebVersion(directory, missingBase, false)).toBe(
      "0.1.0-local",
    );
    expect(() => resolveWebVersion(directory, missingBase, true)).toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
