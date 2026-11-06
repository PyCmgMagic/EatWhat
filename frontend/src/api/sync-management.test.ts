import { describe, expect, it } from "vitest";
import {
  catalogResolution,
  decisionResolution,
  objectResolution,
  parseHubImport,
  profileResolution,
  requireApplied,
} from "./sync-management";
const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
describe("snapshot-bound synchronization decisions", () => {
  it("submits the exact revision, complete candidate versions and chosen member", () => {
    const row = {
      conflictId: id(1),
      revision: 0,
      candidates: [
        { gid: id(2), revision: 3, contentHash: "a" },
        { gid: id(3), revision: 7, contentHash: "b" },
      ],
    };
    expect(catalogResolution(row, "KEEP", id(3), "核对门店资料")).toEqual({
      conflictId: row.conflictId,
      candidates: row.candidates,
      expectedRevision: 0,
      decision: "KEEP",
      winnerGid: id(3),
      reason: "核对门店资料",
    });
    expect(() => catalogResolution(row, "KEEP", id(4), "reason")).toThrow(
      "当前候选",
    );
    expect(() =>
      catalogResolution(
        { ...row, revision: undefined },
        "REJECT",
        "",
        "reason",
      ),
    ).toThrow("默认版本");
  });
  it("carries object heads without guessing the winning version", () => {
    const row = {
      revision: 4,
      heads: [
        {
          operationId: id(1),
          revision: 2,
          contentHash: "a",
          sourceSite: "CAMPUS",
        },
      ],
    };
    expect(objectResolution(row, "REJECT", "", "核对后驳回")).toEqual({
      expectedRevision: 4,
      heads: [{ operationId: id(1), revision: 2, contentHash: "a" }],
      decision: "REJECT",
      winnerOperationId: undefined,
      reason: "核对后驳回",
    });
    expect(() => objectResolution(row, "", "", "reason")).toThrow("处理方式");
  });
  it("binds directory decisions to the returned operation and decision heads", () => {
    const row = { candidateOperations: [id(1), id(2)], decisionHeads: [id(3)] };
    expect(decisionResolution(row, "KEEP", id(2), "已核对")).toMatchObject({
      candidateOperations: row.candidateOperations,
      decisionHeads: row.decisionHeads,
      winnerOperationId: id(2),
    });
    expect(() =>
      decisionResolution(
        { ...row, decisionHeads: null },
        "REJECT",
        "",
        "reason",
      ),
    ).toThrow("不完整");
  });
  it("requires explicit, valid profile candidates rather than coercing opaque heads", () => {
    const row = {
      conflictId: id(1),
      revision: 5,
      heads: [{ unknownField: "value" }],
    };
    expect(() => profileResolution(row, "[]", "REJECT", "", "核对")).toThrow(
      "候选版本",
    );
    expect(
      profileResolution(
        row,
        JSON.stringify([{ gid: id(2), revision: 1, contentHash: "h" }]),
        "KEEP",
        id(2),
        "核对",
      ),
    ).toMatchObject({
      conflictId: id(1),
      expectedRevision: 5,
      winnerGid: id(2),
    });
  });
  it("does not present HTTP-success CONFLICT, BLOCKED or missing statuses as applied", () => {
    expect(requireApplied({ status: "APPLIED", revision: 1 }).status).toBe(
      "APPLIED",
    );
    expect(() => requireApplied({ status: "CONFLICT", revision: 2 })).toThrow(
      "未应用",
    );
    expect(() => requireApplied({ status: "BLOCKED", revision: 2 })).toThrow(
      "未应用",
    );
    expect(() => requireApplied({ revision: 2 })).toThrow("明确的处理结果");
  });
});
describe("catalog import preview", () => {
  const payload = {
    sourceKey: "verified-source",
    requestId: id(1),
    contentHash: "provided-content-hash",
    hubs: [
      {
        sourceId: "north",
        name: "北门美食区",
        centerGcj: { lng: 117.134, lat: 36.667 },
        rebindCoveredRestaurants: false,
      },
    ],
  };
  it("preserves the supplied batch identity and explicit rebinding choice", () => {
    expect(parseHubImport(JSON.stringify(payload))).toMatchObject(payload);
  });
  it("rejects duplicates, unconfirmed rebinding, unknown fields and invalid coordinates before submission", () => {
    expect(() => parseHubImport("{broken")).toThrow("不是有效 JSON");
    expect(() =>
      parseHubImport(
        JSON.stringify({
          ...payload,
          hubs: [...payload.hubs, ...payload.hubs],
        }),
      ),
    ).toThrow("重复");
    expect(() =>
      parseHubImport(
        JSON.stringify({
          ...payload,
          hubs: [{ ...payload.hubs[0], rebindCoveredRestaurants: undefined }],
        }),
      ),
    ).toThrow("明确");
    expect(() =>
      parseHubImport(JSON.stringify({ ...payload, admin: true })),
    ).toThrow("不支持");
    expect(() =>
      parseHubImport(
        JSON.stringify({
          ...payload,
          hubs: [{ ...payload.hubs[0], centerGcj: { lng: 999, lat: 36 } }],
        }),
      ),
    ).toThrow("坐标无效");
  });
});
