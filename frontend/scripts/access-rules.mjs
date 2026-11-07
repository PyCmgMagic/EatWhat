import fs from "node:fs/promises";
import { parse } from "yaml";

export async function accessRulesSource() {
  const spec = parse(
    await fs.readFile(
      new URL("../../docs/EatWhat 业务服务 APIv5.yaml", import.meta.url),
      "utf8",
    ),
  );
  const rules = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      const summary = operation.summary ?? "";
      const secured = operation.security?.some(
        (item) => Object.keys(item).length,
      );
      if (!secured || summary.startsWith("【公开】")) continue;
      const requirement = summary.includes("【需verified】")
        ? "verified"
        : /^\/upload\/presign(?:\/batch)?$/.test(path)
          ? "upload"
          : "login";
      rules.push([method.toUpperCase(), path, requirement]);
    }
  }
  return `// Generated from docs/EatWhat 业务服务 APIv5.yaml by npm run api:access.\n// Do not add button-specific permission rules here.\nexport const requestAccessRules = ${JSON.stringify(rules, null, 2)} as const;\n`;
}

export async function writeAccessRules() {
  await fs.writeFile(
    new URL("../src/api/access-rules.generated.ts", import.meta.url),
    await accessRulesSource(),
  );
}
