import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const require = createRequire(import.meta.url);
const frontend = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const project = resolve(frontend, "..");
const dist = join(frontend, "dist");
const output = join(project, "output");
const packages = join(output, "packages");
const archivePattern = /^\d{8}-\d{6}\.zip$/;

// All cleanup targets are fixed children of this checkout. Reject linked output
// directories before any recursive deletion or replacement can occur.
function ensureOutputDirectory(directory, parent) {
  if (dirname(directory) !== parent)
    throw new Error(`输出目录超出预期范围：${directory}`);
  if (existsSync(directory)) {
    const stat = lstatSync(directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      realpathSync(directory) !== directory
    )
      throw new Error(`输出目录不能是文件或链接：${directory}`);
  } else mkdirSync(directory);
}

function runTool(packageName, entry, args) {
  const executable = join(
    dirname(require.resolve(`${packageName}/package.json`)),
    entry,
  );
  const result = spawnSync(process.execPath, [executable, ...args], {
    cwd: frontend,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${packageName} 执行失败，未生成新压缩包。`);
}

function timestamp() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

function collectFiles(directory, files = Object.create(null)) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(path, files);
    else if (entry.isFile()) {
      files[relative(dist, path).split(sep).join("/")] = readFileSync(path);
    } else throw new Error(`构建产物包含不支持的文件或链接：${path}`);
  }
  return files;
}

let temporaryArchive;
try {
  ensureOutputDirectory(output, project);
  ensureOutputDirectory(packages, output);
  ensureOutputDirectory(dist, frontend);
  const previousArchives = readdirSync(packages).filter(
    (name) =>
      archivePattern.test(name) && lstatSync(join(packages, name)).isFile(),
  );

  console.log("\n[build] 检查 TypeScript…");
  runTool("typescript", "bin/tsc", ["-b"]);
  console.log(`[build] 清理旧构建目录：${dist}`);
  // Async rm avoids the Windows non-ASCII path bug in Node 24.13.0 rmSync.
  await rm(dist, { recursive: true, force: true, maxRetries: 3 });
  if (existsSync(dist)) throw new Error(`旧构建目录清理失败：${dist}`);
  runTool("vite", "bin/vite.js", ["build"]);

  const files = collectFiles(dist);
  if (!files["index.html"] || !files[".vite/manifest.json"])
    throw new Error("构建产物缺少入口或资源清单，未生成新压缩包。");
  const archive = join(packages, `${timestamp()}.zip`);
  if (existsSync(archive)) throw new Error(`同名压缩包已存在：${archive}`);
  const temporary = `${archive}.${process.pid}.tmp`;
  // Only publish a complete archive, then remove prior timestamped packages.
  const compressed = zipSync(files, { level: 6 });
  const descriptor = openSync(temporary, "wx");
  temporaryArchive = temporary;
  try {
    writeFileSync(descriptor, compressed);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, archive);
  temporaryArchive = undefined;
  for (const name of previousArchives) unlinkSync(join(packages, name));
  console.log(`\n[build] 已清理 ${previousArchives.length} 个旧压缩包。`);
  console.log(`[build] 打包完成：${archive}`);
  console.log(
    `[build] ${Object.keys(files).length} 个文件，${(compressed.length / 1024 / 1024).toFixed(2)} MB`,
  );
} catch (error) {
  if (temporaryArchive) await rm(temporaryArchive, { force: true });
  console.error(`\n[build] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
