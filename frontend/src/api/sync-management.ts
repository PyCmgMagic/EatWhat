import { ApiError } from "./client";
import type { Schema } from "./models";

export type SyncRecord = Record<string, unknown>;
export type ResolutionChoice = "KEEP" | "REJECT";
function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label}不是有效 JSON，请检查格式后重试。`);
  }
}
export function record(value: unknown): SyncRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("服务端记录格式不完整，请重新读取。");
  return value as SyncRecord;
}
export function recordList(value: unknown): SyncRecord[] {
  if (!Array.isArray(value)) throw new Error("服务端未返回记录列表。");
  return value.map(record);
}
export function uuid(value: unknown, label = "记录编号") {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
  )
    throw new Error(`${label}不是有效的 UUID，请重新读取。`);
  return value;
}
function revision(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("当前修订号无效，请重新读取；不能用默认版本覆盖。");
  return value;
}
function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`请提供${label}。`);
  return value.trim();
}
function choice(value: string): ResolutionChoice {
  if (value !== "KEEP" && value !== "REJECT")
    throw new Error("请选择处理方式。");
  return value;
}
function winner(value: string, options: string[], decision: ResolutionChoice) {
  if (decision !== "KEEP") return undefined;
  if (!options.includes(value)) throw new Error("请选择当前候选中的一个版本。");
  return uuid(value, "保留版本编号");
}
export function candidateVersions(
  value: unknown,
): Schema["CatalogConflictCandidateVersionRequest"][] {
  const rows = recordList(value);
  if (!rows.length) throw new Error("当前没有可核对的候选版本，请重新读取。");
  const versions = rows.map((row) => ({
    gid: uuid(row.gid, "候选版本编号"),
    revision: revision(row.revision),
    contentHash: text(row.contentHash, "候选内容摘要"),
  }));
  if (new Set(versions.map((item) => item.gid)).size !== versions.length)
    throw new Error("候选版本编号重复，请重新核对。");
  return versions;
}
export function catalogResolution(
  row: SyncRecord,
  selected: string,
  selectedWinner: string,
  reason: string,
): Schema["CatalogConflictResolveRequestRequest"] {
  const decision = choice(selected),
    candidates = candidateVersions(row.candidates);
  return {
    conflictId: uuid(row.conflictId),
    expectedRevision: revision(row.revision),
    candidates,
    decision,
    winnerGid: winner(
      selectedWinner,
      candidates.map((item) => item.gid!),
      decision,
    ),
    reason: text(reason, "处理原因"),
  };
}
export function objectResolution(
  row: SyncRecord,
  selected: string,
  selectedWinner: string,
  reason: string,
): Schema["CatalogConflictResolveHeadRequestRequest"] {
  const decision = choice(selected),
    heads = recordList(row.heads).map((head) => ({
      operationId: uuid(head.operationId, "操作编号"),
      revision: revision(head.revision),
      contentHash: text(head.contentHash, "内容摘要"),
    }));
  if (
    !heads.length ||
    new Set(heads.map((head) => head.operationId)).size !== heads.length
  )
    throw new Error("对象版本为空或重复，请重新读取。");
  return {
    expectedRevision: revision(row.revision),
    heads,
    decision,
    winnerOperationId: winner(
      selectedWinner,
      heads.map((head) => head.operationId),
      decision,
    ),
    reason: text(reason, "处理原因"),
  };
}
export function decisionResolution(
  row: SyncRecord,
  selected: string,
  selectedWinner: string,
  reason: string,
): Schema["CatalogConflictResolveDecisionRequestRequest"] {
  const decision = choice(selected);
  if (
    !Array.isArray(row.candidateOperations) ||
    !Array.isArray(row.decisionHeads)
  )
    throw new Error("目录决策快照不完整，请重新读取。");
  const candidateOperations = row.candidateOperations.map((value) =>
      uuid(value),
    ),
    decisionHeads = row.decisionHeads.map((value) => uuid(value));
  return {
    candidateOperations,
    decisionHeads,
    decision,
    winnerOperationId: winner(selectedWinner, candidateOperations, decision),
    reason: text(reason, "处理原因"),
  };
}
export function profileResolution(
  row: SyncRecord,
  candidateJson: string,
  selected: string,
  selectedWinner: string,
  reason: string,
): Schema["CatalogConflictResolveRequestRequest"] {
  const candidates = candidateVersions(parseJson(candidateJson, "候选版本")),
    decision = choice(selected);
  return {
    conflictId: uuid(row.conflictId),
    expectedRevision: revision(row.revision),
    candidates,
    decision,
    winnerGid: winner(
      selectedWinner,
      candidates.map((item) => item.gid!),
      decision,
    ),
    reason: text(reason, "处理原因"),
  };
}
export function requireApplied(result: Schema["ResolutionResultResponse"]) {
  if (result.status === "APPLIED") return result;
  if (result.status === "CONFLICT")
    throw new ApiError(
      "版本已变化，本次未应用。请重新读取并核对后再处理。",
      "SYNC_CONFLICT",
    );
  if (result.status === "BLOCKED")
    throw new ApiError(
      "处理被阻止，本次未应用。请检查授权复核和服务端限制。",
      "SYNC_BLOCKED",
    );
  throw new ApiError(
    "服务端未返回明确的处理结果，请刷新列表核实。",
    "INVALID_RESPONSE",
  );
}
export function parseHubImport(
  json: string,
): Schema["CatalogHubImportRequestRequest"] {
  const input = record(parseJson(json, "目录文件"));
  for (const key of Object.keys(input))
    if (!["sourceKey", "requestId", "contentHash", "hubs"].includes(key))
      throw new Error(`不支持的导入字段：${key}`);
  const hubs = recordList(input.hubs).map((hub, index) => {
    for (const key of Object.keys(hub))
      if (
        ![
          "sourceId",
          "name",
          "centerWgs",
          "centerGcj",
          "boundaryGeoJson",
          "rebindCoveredRestaurants",
        ].includes(key)
      )
        throw new Error(`第 ${index + 1} 项包含未知字段：${key}`);
    const coordinate = (value: unknown, gcj: boolean) => {
      if (value === undefined) return undefined;
      const point = record(value),
        lng = point.lng,
        lat = point.lat;
      if (
        typeof lng !== "number" ||
        typeof lat !== "number" ||
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        Math.abs(lng) > 180 ||
        Math.abs(lat) > 90
      )
        throw new Error(`第 ${index + 1} 项坐标无效。`);
      if (
        gcj &&
        (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271)
      )
        throw new Error(`第 ${index + 1} 项 GCJ02 坐标超出支持范围。`);
      return { lng, lat };
    };
    const centerWgs = coordinate(hub.centerWgs, false),
      centerGcj = coordinate(hub.centerGcj, true);
    if (!centerWgs && !centerGcj)
      throw new Error(`第 ${index + 1} 项需要中心坐标。`);
    if (typeof hub.rebindCoveredRestaurants !== "boolean")
      throw new Error(`第 ${index + 1} 项需要明确是否重新绑定餐厅。`);
    const boundaryGeoJson =
      hub.boundaryGeoJson === undefined
        ? undefined
        : text(hub.boundaryGeoJson, "边界 GeoJSON");
    if (boundaryGeoJson) {
      const geometry = record(JSON.parse(boundaryGeoJson));
      if (
        !["Polygon", "MultiPolygon", "Feature"].includes(String(geometry.type))
      )
        throw new Error(`第 ${index + 1} 项边界不是有效区域。`);
    }
    return {
      sourceId: text(hub.sourceId, `第 ${index + 1} 项来源编号`),
      name: text(hub.name, `第 ${index + 1} 项名称`),
      centerWgs,
      centerGcj,
      boundaryGeoJson,
      rebindCoveredRestaurants: hub.rebindCoveredRestaurants,
    };
  });
  if (!hubs.length) throw new Error("导入文件没有区域记录。");
  if (new Set(hubs.map((hub) => hub.sourceId)).size !== hubs.length)
    throw new Error("来源编号重复，请先清理文件。");
  return {
    sourceKey: text(input.sourceKey, "来源标识"),
    requestId: uuid(input.requestId, "批次编号"),
    contentHash: text(input.contentHash, "来源文件内容摘要"),
    hubs,
  };
}
