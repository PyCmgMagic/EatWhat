import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { parse } from "yaml";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sourceRoot = path.join(root, "frontend/src");
const read = (file) => fs.readFileSync(file, "utf8");
const relative = (file) => path.relative(root, file).replaceAll("\\", "/");
const contractPath = path.join(
  root,
  "docs/EatWhat 业务服务 APIv7.openapi.json",
);
const spec = parse(read(contractPath));
const verbs = ["get", "post", "put", "patch", "delete", "head", "options"];
const operations = Object.entries(spec.paths).flatMap(([template, item]) =>
  verbs
    .filter((method) => item[method])
    .map((method) => ({
      key: `${method.toUpperCase()} ${template}`,
      template,
      method,
      operation: item[method],
    })),
);
const transpile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const moduleUrl = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const modules = new Map();
function compile(file) {
  if (modules.has(file)) return modules.get(file);
  const source = transpile(read(file)).replace(
    /from ["'](\.[^"']+)["']/g,
    (all, target) => {
      const dependency = path.resolve(path.dirname(file), target + ".ts");
      return fs.existsSync(dependency)
        ? 'from "' + compile(dependency) + '"'
        : all;
    },
  );
  const url = moduleUrl(source);
  modules.set(file, url);
  return url;
}
const { createApi } = await import(
  compile(path.join(sourceRoot, "api/service.ts"))
);
const serviceCalls = [];
const methodNames = Object.keys(
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
          serviceCalls.push({ name, url, options });
          return { code: 0, data: { id: 123, items: [] } };
        }, auditCaptcha)[name](...args),
  },
);
const fixture = read(path.join(sourceRoot, "api/contract.test.ts"));
const calls = fixture.match(/await Promise\.all\((\[[\s\S]*?\])\);/)?.[1];
if (!calls) throw new Error("Cannot locate service operation fixtures");
await new Function("api", `return Promise.all(${calls});`)(api);
const missingFixtures = methodNames.filter(
  (name) => !serviceCalls.some((call) => call.name === name),
);
if (missingFixtures.length)
  throw new Error("Missing service fixture: " + missingFixtures.join(", "));
const services = new Map();
for (const call of serviceCalls) {
  const operation = operations.find(
    (op) =>
      op.method === (call.options.method ?? "GET").toLowerCase() &&
      new RegExp("^" + op.template.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(
        call.url,
      ),
  );
  if (!operation) throw new Error("Uncontracted operation: " + call.url);
  services.set(operation.key, [
    ...new Set([...(services.get(operation.key) ?? []), call.name]),
  ]);
}

// Follow runtime imports from the actual entry point, excluding type-only imports.
const reachable = new Map();
function resolveImport(file, target) {
  if (!target.startsWith(".")) return;
  const base = path.resolve(path.dirname(file), target);
  return [
    base,
    ...[".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"].map(
      (ext) => base + ext,
    ),
  ].find(
    (candidate) =>
      /\.[jt]sx?$/.test(candidate) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile(),
  );
}
function follow(file) {
  if (reachable.has(file)) return;
  const ast = ts.createSourceFile(
    file,
    read(file),
    ts.ScriptTarget.Latest,
    true,
  );
  reachable.set(file, ast);
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly &&
      !node.importClause?.isTypeOnly
    ) {
      const target = resolveImport(file, node.moduleSpecifier.text);
      if (target) follow(target);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const target = resolveImport(file, node.arguments[0].text);
      if (target) follow(target);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
follow(path.join(sourceRoot, "main.tsx"));
const usages = new Map();
for (const [file, ast] of reachable) {
  if (
    file.includes(path.sep + "demo" + path.sep) ||
    /\.test\.[jt]sx?$/.test(file)
  )
    continue;
  function visit(node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      methodNames.includes(node.name.text)
    ) {
      const receiver = node.expression;
      if (
        (ts.isIdentifier(receiver) && receiver.text === "api") ||
        (ts.isPropertyAccessExpression(receiver) &&
          receiver.name.text === "api")
      ) {
        const position = ast.getLineAndCharacterOfPosition(node.getStart());
        const location = { file: relative(file), line: position.line + 1 };
        usages.set(node.name.text, [
          ...(usages.get(node.name.text) ?? []),
          location,
        ]);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
const rows = operations.map(({ key, template, method, operation }) => {
  const methods = services.get(key) ?? [];
  const consumers = [
    ...new Map(
      methods
        .flatMap((name) => usages.get(name) ?? [])
        .map((location) => [location.file + ":" + location.line, location]),
    ).values(),
  ];
  return {
    key,
    path: template,
    method: method.toUpperCase(),
    summary: operation.summary,
    permission: operation["x-permission"],
    serviceMethods: methods,
    consumers,
    status: methods.length
      ? consumers.length
        ? "referenced-in-current-app"
        : "service-only"
      : "not-wrapped",
    parameters: operation.parameters ?? [],
    requestBody: operation.requestBody,
    description: operation.description,
    conditionalProperties: operation["x-conditional-properties"],
    response:
      operation.responses?.["200"]?.content?.["application/json"]?.schema,
  };
});
const groupOf = (row) =>
  /^\/(activity|admin\/activities)(\/|$)/.test(row.path)
    ? "activity"
    : /^(?:\/auth)?\/callback(?:\/|$)/.test(row.path) ||
        row.path === "/auth/verifyEmail"
      ? "external-auth-callback"
      : "client";
for (const row of rows) {
  row.category = groupOf(row);
  row.disposition =
    row.category === "activity"
      ? "明确排除"
      : row.category === "external-auth-callback"
        ? "后端回调"
        : "客户端已接入";
  if (row.disposition === "客户端已接入" && !row.serviceMethods.length)
    throw new Error("Missing operation: " + row.key);
}
const notWrappedGroupCounts = Object.fromEntries(
  [
    ...new Set(
      rows
        .filter((row) => row.status === "not-wrapped")
        .map((row) => row.category),
    ),
  ].map((category) => [
    category,
    rows.filter(
      (row) => row.status === "not-wrapped" && row.category === category,
    ).length,
  ]),
);
const summary = {
  contract: relative(contractPath),
  version: spec.info.version,
  total: rows.length,
  serviceOperationFixtures: serviceCalls.length,
  uniqueWrappedOperations: rows.filter((row) => row.serviceMethods.length)
    .length,
  referencedInCurrentApp: rows.filter((row) => row.consumers.length).length,
  serviceOnly: rows.filter((row) => row.status === "service-only").length,
  notWrapped: rows.filter((row) => row.status === "not-wrapped").length,
  reachableSourceFiles: reachable.size,
  realBackendRequests: 0,
  clientOperations: rows.filter((r) => r.disposition.startsWith("客户端"))
    .length,
  backendCallbacks: rows.filter((r) => r.disposition === "后端回调").length,
  excluded: rows.filter((r) => r.disposition === "明确排除").length,
  notWrappedGroupCounts,
};
const report = {
  summary,
  scope: {
    userExcludedCategories: ["activity"],
    userDeferredCategories: [],
    backendFlowOrLegacyCategories: [
      "disabled-auth-callback",
      "external-auth-callback",
      "alternate-sso-start",
      "legacy-sms-entry",
    ],
  },
  limitations: [
    "Service coverage is HTTP method + path, not proof of live backend integration.",
    "Consumers are static references in runtime-import-reachable files; individual routes and branches need manual review.",
    "Callback endpoints and HTTP aliases may be intentionally called by external services rather than UI.",
  ],
  operations: rows,
};
fs.writeFileSync(
  path.join(root, "output/api-v7-coverage-20261110.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      summary,
      serviceOnly: rows.filter((row) => row.status === "service-only"),
      notWrapped: rows
        .filter((row) => row.status === "not-wrapped")
        .map(({ key, summary, permission }) => ({ key, summary, permission })),
    },
    null,
    2,
  ),
);
