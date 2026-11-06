import fs from "node:fs";

const root = new URL("../../", import.meta.url);
const beforeFile = "docs/EatWhat 业务服务 APIv2.openapi.json";
const afterFile = "docs/EatWhat 业务服务 APIv3.openapi.json";
const read = (file) => JSON.parse(fs.readFileSync(new URL(file, root), "utf8"));
const before = read(beforeFile),
  after = read(afterFile);
const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
const operations = (spec) =>
  new Map(
    Object.entries(spec.paths).flatMap(([path, item]) =>
      methods
        .filter((method) => item[method])
        .map((method) => [
          method.toUpperCase() + " " + path,
          {
            operation: item[method],
            pathParameters: item.parameters ?? [],
          },
        ]),
    ),
  );
const oldOps = operations(before),
  newOps = operations(after);
const metadata = new Set([
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

// Compare the nullable encodings in OAS 3.1 and this document's OAS 3.0 export equally.
function normalize(value, key = "") {
  if (Array.isArray(value)) {
    const values = value.map((v) => normalize(v));
    return ["required", "enum"].includes(key)
      ? values.sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        )
      : values;
  }
  if (!value || typeof value !== "object") return value;
  let current = { ...value };
  if (key !== "properties") {
    for (const [exclusive, bound] of [
      ["exclusiveMinimum", "minimum"],
      ["exclusiveMaximum", "maximum"],
    ]) {
      if (current[exclusive] === true && typeof current[bound] === "number")
        current[exclusive] = current[bound];
      else if (current[exclusive] === false) delete current[exclusive];
    }
    if (Array.isArray(current.type) && current.type.includes("null")) {
      const types = current.type.filter((t) => t !== "null");
      current.type = types.length === 1 ? types[0] : types;
      current.nullable = true;
    }
    if (
      current.anyOf?.length === 2 &&
      current.anyOf.some((v) => v.type === "null")
    ) {
      const nonNull = current.anyOf.find((v) => v.type !== "null");
      delete current.anyOf;
      current = { ...nonNull, ...current, nullable: true };
    }
  }
  return Object.fromEntries(
    Object.keys(current)
      .filter((k) => key === "properties" || !metadata.has(k))
      .sort()
      .map((k) => [k, normalize(current[k], k)]),
  );
}

function diff(a, b, path = "") {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (
    Array.isArray(a) &&
    Array.isArray(b) &&
    !/\/(required|enum|type)$/.test(path)
  )
    return Array.from(
      { length: Math.max(a.length, b.length) },
      (_, i) => i,
    ).flatMap((i) => diff(a[i], b[i], path + "/" + i));
  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  )
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) =>
      diff(a[k], b[k], path + "/" + k),
    );
  return [{ path, before: a, after: b }];
}

function contract(entry, spec) {
  const op = entry.operation;
  return normalize({
    parameters: Object.fromEntries(
      [...entry.pathParameters, ...(op.parameters ?? [])]
        .map((p) => resolve(p, spec))
        .map((p) => [p.in + ":" + p.name, p]),
    ),
    requestBody: resolve(op.requestBody, spec),
    responses: resolve(op.responses, spec),
    security: op.security ?? spec.security ?? [],
    deprecated: op.deprecated ?? false,
    extensions: Object.fromEntries(
      Object.entries(op).filter(([k]) => k.startsWith("x-")),
    ),
  });
}

const changed = [],
  descriptionChanges = [],
  documentationOnly = [];
for (const [key, next] of newOps) {
  const previous = oldOps.get(key);
  if (!previous) continue;
  const changes = diff(contract(previous, before), contract(next, after));
  if (changes.length)
    changed.push({ key, summary: next.operation.summary, changes });
  const oldDescription = previous.operation.description ?? "",
    newDescription = next.operation.description ?? "";
  if (oldDescription !== newDescription) {
    const dateOnly =
      oldDescription.replaceAll(/2026-10-\d{2}/g, "<date>") ===
      newDescription.replaceAll(/2026-10-\d{2}/g, "<date>");
    descriptionChanges.push({
      key,
      dateOnly,
      before: oldDescription,
      after: newDescription,
    });
  }
  if (
    !changes.length &&
    JSON.stringify(previous.operation) !== JSON.stringify(next.operation)
  )
    documentationOnly.push(key);
}

const oldSchemas = before.components?.schemas ?? {},
  newSchemas = after.components?.schemas ?? {};
const schemaChanges = Object.keys(newSchemas)
  .filter((k) => oldSchemas[k])
  .map((name) => ({
    name,
    changes: diff(normalize(oldSchemas[name]), normalize(newSchemas[name])),
  }))
  .filter((s) => s.changes.length);
const report = {
  comparedAt: "2026-11-02",
  beforeFile,
  afterFile,
  beforeVersion: before.info.version,
  afterVersion: after.info.version,
  beforeOpenAPI: before.openapi,
  afterOpenAPI: after.openapi,
  beforePathCount: Object.keys(before.paths).length,
  afterPathCount: Object.keys(after.paths).length,
  beforeOperationCount: oldOps.size,
  afterOperationCount: newOps.size,
  added: [...newOps.keys()].filter((k) => !oldOps.has(k)),
  removed: [...oldOps.keys()].filter((k) => !newOps.has(k)),
  changed,
  schemaChanges,
  addedSchemas: Object.keys(newSchemas).filter((k) => !oldSchemas[k]),
  removedSchemas: Object.keys(oldSchemas).filter((k) => !newSchemas[k]),
  documentationOnly,
  descriptionChanges,
  scope:
    "Local specification comparison and source review only; no production capability or authenticated flow was tested.",
};
fs.writeFileSync(
  new URL("output/api-v3-diff-20261102.json", root),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      beforeOperationCount: oldOps.size,
      afterOperationCount: newOps.size,
      added: report.added,
      removed: report.removed,
      changed: changed.map((row) => ({
        key: row.key,
        changes: row.changes.map((c) => ({
          ...c,
          before:
            JSON.stringify(c.before)?.length > 1000
              ? "See full report"
              : c.before,
          after:
            JSON.stringify(c.after)?.length > 1000
              ? "See full report"
              : c.after,
        })),
      })),
      schemaChanges,
      addedSchemas: report.addedSchemas,
      removedSchemas: report.removedSchemas,
      documentationOnly: documentationOnly.length,
      meaningfulDescriptionChanges: descriptionChanges
        .filter((r) => !r.dateOnly)
        .map((r) => r.key),
    },
    null,
    2,
  ),
);
