import fs from "node:fs/promises";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";
import { parse } from "yaml";
import { writeAccessRules } from "./access-rules.mjs";

const source = new URL(
  "../../docs/EatWhat 业务服务 APIv7.openapi.json",
  import.meta.url,
);
const output = new URL("../src/api/schema.d.ts", import.meta.url);

// The generator resolves $ref before checking its nullable sibling. Express the
// same union explicitly so referenced summaries and response data retain null.
function nullableRefs(value) {
  if (Array.isArray(value)) return value.map(nullableRefs);
  if (!value || typeof value !== "object") return value;
  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, nullableRefs(item)]),
  );
  if (typeof normalized.$ref === "string" && normalized.nullable === true) {
    const { $ref, nullable, ...rest } = normalized;
    return { ...rest, anyOf: [{ $ref }, { type: "null" }] };
  }
  return normalized;
}

const spec = parse(await fs.readFile(source, "utf8"));
const ast = await openapiTS(nullableRefs(spec));
await fs.writeFile(output, COMMENT_HEADER + astToString(ast));
await writeAccessRules();
console.log(
  `Generated API types from ${spec.info.version}, preserving nullable references.`,
);
