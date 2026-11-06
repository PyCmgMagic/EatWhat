import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const beforeFile = "docs/EatWhat 业务服务 API.openapi.json";
const afterFile = "docs/EatWhat 业务服务 APIv2.openapi.json";
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const before = JSON.parse(read(beforeFile)),
  after = JSON.parse(read(afterFile));
const verbs = ["get", "post", "put", "patch", "delete", "head", "options"];
const operations = (spec) =>
  new Map(
    Object.entries(spec.paths).flatMap(([url, item]) =>
      verbs
        .filter((m) => item[m])
        .map((method) => [
          `${method.toUpperCase()} ${url}`,
          {
            url,
            method,
            operation: item[method],
            pathParameters: item.parameters ?? [],
          },
        ]),
    ),
  );
const oldOps = operations(before),
  newOps = operations(after);
const ignored = new Set([
  "description",
  "summary",
  "example",
  "examples",
  "title",
  "tags",
  "operationId",
  "externalDocs",
]);
function resolve(value, spec, seen = new Set()) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => resolve(v, spec, seen));
  if (value.$ref?.startsWith("#/")) {
    if (seen.has(value.$ref)) return { $recursiveRef: value.$ref };
    const target = value.$ref
      .slice(2)
      .split("/")
      .reduce(
        (o, k) => o?.[k.replaceAll("~1", "/").replaceAll("~0", "~")],
        spec,
      );
    if (!target) throw new Error("Unresolved reference: " + value.$ref);
    return resolve(
      {
        ...target,
        ...Object.fromEntries(
          Object.entries(value).filter(([k]) => k !== "$ref"),
        ),
      },
      spec,
      new Set([...seen, value.$ref]),
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, resolve(v, spec, seen)]),
  );
}
function normalize(value, key = "") {
  if (Array.isArray(value)) {
    const a = value.map((v) => normalize(v));
    return ["required", "enum"].includes(key)
      ? a.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      : a;
  }
  if (!value || typeof value !== "object") return value;
  // A business field named "description" or "title" is not schema metadata.
  return Object.fromEntries(
    Object.keys(value)
      .filter((k) => key === "properties" || !ignored.has(k))
      .sort()
      .map((k) => [k, normalize(value[k], k)]),
  );
}
function diff(a, b, p = "") {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  )
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) =>
      diff(a[k], b[k], p + "/" + k),
    );
  return [{ path: p, before: a, after: b }];
}
function contract(entry, spec) {
  const { operation: op } = entry;
  return normalize({
    parameters: Object.fromEntries(
      [...entry.pathParameters, ...(op.parameters ?? [])]
        .map((p) => resolve(p, spec))
        .map((p) => [p.in + ":" + p.name, p]),
    ),
    requestBody: resolve(op.requestBody, spec),
    responses: resolve(op.responses, spec),
    security: op.security ?? spec.security ?? [],
  });
}
const added = [...newOps]
  .filter(([key]) => !oldOps.has(key))
  .map(([key, e]) => ({
    key,
    summary: e.operation.summary,
    description: e.operation.description,
    contract: contract(e, after),
  }));
const removed = [...oldOps]
  .filter(([key]) => !newOps.has(key))
  .map(([key, e]) => ({ key, summary: e.operation.summary }));
const changed = [...newOps]
  .filter(([key]) => oldOps.has(key))
  .map(([key, e]) => ({
    key,
    summary: e.operation.summary,
    changes: diff(contract(oldOps.get(key), before), contract(e, after)),
  }))
  .filter((e) => e.changes.length);
const documentationOnly = [...newOps]
  .filter(
    ([key, e]) =>
      oldOps.has(key) &&
      JSON.stringify(oldOps.get(key).operation) !==
        JSON.stringify(e.operation) &&
      !changed.some((c) => c.key === key),
  )
  .map(([key]) => key);
const oldSchemas = before.components?.schemas ?? {},
  newSchemas = after.components?.schemas ?? {};
const schemaChanges = Object.keys(newSchemas)
  .filter((k) => oldSchemas[k])
  .map((name) => ({
    name,
    changes: diff(normalize(oldSchemas[name]), normalize(newSchemas[name])),
  }))
  .filter((s) => s.changes.length);

// Execute only existing local service fixtures against an in-memory transport.
const transpile = (text) =>
  ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const moduleUrl = (text) =>
  "data:text/javascript;base64," + Buffer.from(text).toString("base64");
const clientUrl = moduleUrl(transpile(read("frontend/src/api/client.ts")));
const { createApi } = await import(
  moduleUrl(
    transpile(read("frontend/src/api/service.ts")).replace(
      'from "./client"',
      `from "${clientUrl}"`,
    ),
  )
);
const calls = [];
const methods = Object.keys(
  createApi(async () => ({ code: 0, data: { id: 123 } })),
);
const auditCaptcha = async (getConfig, send, signal) => {
  const active = signal ?? new AbortController().signal;
  await getConfig(active);
  return send(
    { "X-Captcha-Ticket": "audit", "X-Captcha-Randstr": "audit" },
    active,
  );
};
const api = new Proxy(
  {},
  {
    get:
      (_, name) =>
      (...args) =>
        createApi(async (url, options) => {
          calls.push({ name, url, options });
          return { code: 0, data: { id: 123, items: [] } };
        }, auditCaptcha)[name](...args),
  },
);
const fixtures = read("frontend/src/api/contract.test.ts").match(
  /await Promise\.all\((\[[\s\S]*?\])\);/,
)?.[1];
if (!fixtures) throw new Error("Service fixture block not found");
await new Function("api", `return Promise.all(${fixtures});`)(api);
if (methods.some((m) => !calls.some((c) => c.name === m)))
  throw new Error("Service fixtures incomplete");
const consumers = {};
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "generated") scan(file);
      continue;
    }
    if (
      !/\.tsx?$/.test(file) ||
      /\.test\.ts$|\.d\.ts$/.test(file) ||
      file.endsWith("service.ts")
    )
      continue;
    const text = fs.readFileSync(file, "utf8"),
      source = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const name = node.expression.name.text,
          object = node.expression.expression.getText(source);
        if (methods.includes(name) && /(^|\.)api$/.test(object))
          (consumers[name] ??= []).push({
            file: path.relative(root, file).replaceAll("\\", "/"),
            line:
              source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}
scan(path.join(root, "frontend/src"));
const matcher = (template) =>
  new RegExp(
    "^" +
      template
        .split(/(\{[^}]+\})/g)
        .map((part) =>
          part.startsWith("{")
            ? "[^/]+"
            : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join("") +
      "$",
  );
const existingServices = calls.map((call) => {
  const matched = [...newOps].find(
    ([, op]) =>
      op.method === (call.options.method ?? "GET").toLowerCase() &&
      matcher(op.url).test(call.url),
  );
  const requiredMissing = [];
  if (matched) {
    const schema = contract(matched[1], after);
    for (const p of Object.values(schema.parameters))
      if (p.required && p.in !== "path") {
        const provided =
          p.in === "query"
            ? call.options.query?.[p.name]
            : p.in === "header"
              ? new Headers(call.options.headers).get(p.name)
              : undefined;
        if (provided === undefined || provided === null)
          requiredMissing.push({ in: p.in, name: p.name });
      }
    const body = schema.requestBody?.content?.["application/json"]?.schema;
    for (const key of body?.required ?? [])
      if (call.options.body?.[key] === undefined)
        requiredMissing.push({ in: "body", name: key });
  }
  return {
    name: call.name,
    key: matched?.[0] ?? `${call.options.method ?? "GET"} ${call.url}`,
    exists: !!matched,
    requiredMissing,
    consumers: consumers[call.name] ?? [],
  };
});
const captcha = [...newOps]
  .filter(([, e]) =>
    (e.operation.parameters ?? []).some((p) => p.name === "X-Captcha-Ticket"),
  )
  .map(([key, e]) => ({
    key,
    summary: e.operation.summary,
    headers: e.operation.parameters.filter((p) => p.in === "header"),
  }));
const report = {
  date: "2026-10-26",
  before: {
    file: beforeFile,
    info: before.info,
    operations: oldOps.size,
    servers: before.servers,
  },
  after: {
    file: afterFile,
    info: after.info,
    operations: newOps.size,
    servers: after.servers,
  },
  added,
  removed,
  changed,
  documentationOnly,
  newSchemas: Object.keys(newSchemas).filter((k) => !oldSchemas[k]),
  removedSchemas: Object.keys(oldSchemas).filter((k) => !newSchemas[k]),
  schemaChanges,
  existingServices,
  captcha,
};
fs.writeFileSync(
  path.join(root, "output/api-v2-diff-20261026.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const summary = {
  before: oldOps.size,
  after: newOps.size,
  added: added.map((o) => ({ key: o.key, summary: o.summary })),
  removed,
  changed: changed.map((o) => ({
    key: o.key,
    count: o.changes.length,
    paths: o.changes.map((c) => c.path),
  })),
  documentationOnly: documentationOnly.length,
  newSchemas: report.newSchemas,
  removedSchemas: report.removedSchemas,
  schemaChanges: schemaChanges.map((s) => ({
    name: s.name,
    changes: s.changes,
  })),
  services: {
    count: existingServices.length,
    unmatched: existingServices.filter((s) => !s.exists),
    requiredMissing: existingServices.filter((s) => s.requiredMissing.length),
  },
  captcha: captcha.map((c) => ({
    key: c.key,
    required: c.headers.map((h) => ({ name: h.name, required: h.required })),
  })),
};
fs.writeFileSync(
  path.join(root, "output/api-v2-diff-20261026-summary.json"),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      before: summary.before,
      after: summary.after,
      added: summary.added,
      removed: summary.removed,
      changed: summary.changed.map((c) => ({ key: c.key, count: c.count })),
      documentationOnly: summary.documentationOnly,
      newSchemas: summary.newSchemas,
      removedSchemas: summary.removedSchemas,
      schemaChanges: summary.schemaChanges.map((s) => ({
        name: s.name,
        count: s.changes.length,
      })),
      services: summary.services,
      captcha: summary.captcha,
    },
    null,
    2,
  ),
);
