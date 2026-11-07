import { accessRulesSource, writeAccessRules } from "./access-rules.mjs";
import fs from "node:fs/promises";

if (process.argv.includes("--check")) {
  const actual = await fs.readFile(
    new URL("../src/api/access-rules.generated.ts", import.meta.url),
    "utf8",
  );
  if (actual.replaceAll("\r\n", "\n") !== (await accessRulesSource()))
    throw new Error(
      "API permissions changed. Run npm run api:access to update the shared rules.",
    );
} else await writeAccessRules();
