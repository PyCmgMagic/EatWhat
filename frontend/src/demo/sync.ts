import { ApiError } from "../api/client";
import {
  catalogResolution,
  objectResolution,
  decisionResolution,
  parseHubImport,
} from "../api/sync-management";
export const syncDemoId = (id: number) =>
  `11111111-1111-4111-8111-${String(id).padStart(12, "0")}`;
export function seedSync() {
  const candidates = [
    {
      gid: syncDemoId(10),
      numericId: 1,
      sourceSite: "CAMPUS",
      revision: 3,
      contentHash: "demo-campus-v3",
      summary: { name: "北门美食区", address: "软件园校区北门" },
    },
    {
      gid: syncDemoId(11),
      numericId: 2,
      sourceSite: "SINGAPORE",
      revision: 4,
      contentHash: "demo-external-v4",
      summary: { name: "北门餐饮区", address: "软件园北门对面" },
    },
  ];
  const profile = {
    conflictId: syncDemoId(4),
    subjectId: syncDemoId(40),
    fieldGroup: "个人资料",
    revision: 3,
    heads: [
      {
        id: syncDemoId(41),
        value: { signature: "好好吃饭，认真生活" },
        vector: { CAMPUS: 1 },
      },
      {
        id: syncDemoId(42),
        value: { signature: "记录校园里的好味道" },
        vector: { SINGAPORE: 2 },
      },
    ],
  };
  return {
    hubMappings: {} as Record<string, number>,
    catalog: [
      {
        conflictId: syncDemoId(1),
        kind: "HUB",
        naturalKey: "软件园校区 · 北门美食区",
        revision: 4,
        status: "OPEN",
        candidates,
      },
    ],
    objects: [
      {
        conflictId: syncDemoId(2),
        objectGid: syncDemoId(20),
        numericId: 6,
        revision: 2,
        status: "OPEN",
        heads: [
          {
            operationId: syncDemoId(21),
            revision: 1,
            contentHash: "demo-head-a",
            sourceSite: "CAMPUS",
          },
          {
            operationId: syncDemoId(22),
            revision: 2,
            contentHash: "demo-head-b",
            sourceSite: "SINGAPORE",
          },
        ],
      },
    ],
    decisions: [
      {
        conflictId: syncDemoId(3),
        kind: "FOOD",
        objectGid: syncDemoId(30),
        status: "OPEN",
        decisionHeads: [syncDemoId(33), syncDemoId(34)],
        candidateOperations: [syncDemoId(31), syncDemoId(32)],
      },
    ],
    catalogReviews: [
      {
        eventId: syncDemoId(5),
        conflictId: syncDemoId(1),
        kind: "HUB",
        objectGid: syncDemoId(20),
        reason: "目录授权范围需要人工核对",
        status: "PENDING",
      },
    ],
    profiles: [profile],
    profileReviews: [
      {
        eventId: syncDemoId(6),
        actorId: syncDemoId(60),
        reason: "资料同步授权版本需要核对",
        conflict: { ...profile, conflictId: syncDemoId(7) },
      },
    ],
    imports: [] as {
      requestId: string;
      contentHash: string;
      batchId: string;
      created: number;
      updated: number;
      status: string;
    }[],
  };
}
export type DemoSync = ReturnType<typeof seedSync>;
export function demoSync(
  state: DemoSync,
  path: string,
  method: string,
  body: Record<string, unknown>,
): unknown {
  const catalog = "/admin/sync/catalog/conflicts",
    profiles = "/admin/sync/profile-conflicts";
  if (method === "GET") {
    if (path === catalog)
      return state.catalog.filter((row) => row.status === "OPEN");
    if (path === catalog + "/objects")
      return state.objects.filter((row) => row.status === "OPEN");
    if (path === catalog + "/decisions") return state.decisions;
    if (path.startsWith(catalog + "/decisions/"))
      return (
        state.decisions.find(
          (row) => row.conflictId === path.split("/").at(-1),
        ) ?? null
      );
    if (path === catalog + "/reviews") return state.catalogReviews;
    if (path === profiles) return state.profiles;
    if (path === profiles + "/authorization-reviews")
      return state.profileReviews;
  }
  if (method === "POST" && path === "/admin/sync/catalog/import/hubs") {
    const request = parseHubImport(JSON.stringify(body));
    const old = state.imports.find(
      (item) => item.requestId === request.requestId,
    );
    if (old)
      return {
        ...old,
        status:
          old.contentHash === request.contentHash ? "REPLAYED" : "CONFLICT",
      };
    const result = {
      requestId: request.requestId!,
      contentHash: request.contentHash!,
      batchId: syncDemoId(100 + state.imports.length),
      status: "APPLIED",
      created: request.hubs!.length,
      updated: 0,
    };
    state.imports.push(result);
    return result;
  }
  if (method === "POST" && path.endsWith("/resolve")) {
    const id = path.split("/").at(-2),
      decision = String(body.decision ?? ""),
      reason = String(body.reason ?? "");
    if (path.startsWith(catalog + "/objects/")) {
      const row = state.objects.find((row) => row.conflictId === id);
      if (!row) throw new ApiError("记录不存在", 404);
      objectResolution(
        row,
        decision,
        String(body.winnerOperationId ?? ""),
        reason,
      );
      if (
        row.status !== "OPEN" ||
        body.expectedRevision !== row.revision ||
        JSON.stringify(body.heads) !==
          JSON.stringify(
            row.heads.map(({ operationId, revision, contentHash }) => ({
              operationId,
              revision,
              contentHash,
            })),
          )
      )
        return { status: "CONFLICT", revision: row.revision };
      row.status = "RESOLVED";
      row.revision++;
      return { status: "APPLIED", revision: row.revision };
    }
    if (path.startsWith(catalog + "/decisions/")) {
      const row = state.decisions.find((row) => row.conflictId === id);
      if (!row) throw new ApiError("记录不存在", 404);
      decisionResolution(
        row,
        decision,
        String(body.winnerOperationId ?? ""),
        reason,
      );
      if (
        JSON.stringify(body.decisionHeads) !==
          JSON.stringify(row.decisionHeads) ||
        JSON.stringify(body.candidateOperations) !==
          JSON.stringify(row.candidateOperations)
      )
        return { status: "CONFLICT", revision: 1 };
      row.status = "RESOLVED";
      row.decisionHeads = [syncDemoId(90)];
      return { status: "APPLIED", revision: 2 };
    }
    if (path.startsWith(catalog + "/")) {
      const row = state.catalog.find((row) => row.conflictId === id);
      if (!row) throw new ApiError("记录不存在", 404);
      catalogResolution(row, decision, String(body.winnerGid ?? ""), reason);
      if (row.status !== "OPEN" || body.expectedRevision !== row.revision)
        return { status: "CONFLICT", revision: row.revision };
      row.status = "RESOLVED";
      row.revision++;
      return { status: "APPLIED", revision: row.revision };
    }
    const review = path.startsWith(profiles + "/authorization-reviews/");
    const row = review
      ? state.profileReviews.find((row) => row.eventId === id)?.conflict
      : state.profiles.find((row) => row.conflictId === id);
    if (!row) throw new ApiError("记录不存在", 404);
    if (
      typeof body.selectedHeadId !== "string" ||
      !row.heads.some((head) => head.id === body.selectedHeadId)
    )
      throw new ApiError("请选择当前资料候选。", 400);
    if (body.expectedRevision !== row.revision)
      throw new ApiError("版本已变化，请重新读取。", "SYNC_CONFLICT");
    if (review)
      state.profileReviews = state.profileReviews.filter(
        (item) => item.eventId !== id,
      );
    else
      state.profiles = state.profiles.filter((item) => item.conflictId !== id);
    return null;
  }
  throw new ApiError("这项同步管理功能正在准备中，敬请期待。", 404);
}
