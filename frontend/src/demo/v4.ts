import { telemetryPages } from "../api/v4-types";
import { ApiError, type RequestOptions, type Query } from "../api/client";
import { readSession } from "../app/runtime";
import { demoFeedbackFields } from "./feedback";
import { mealSlotAt } from "../api/food-display";
import { demoRecommendationPage, type DemoExposure } from "./recommendations";
import {
  dislikableTags,
  shopCategories,
  tasteTags,
  type V2Food,
  type V2Shop,
} from "../api/v2-vocab";
import {
  mediaUrl,
  type Food,
  type Restaurant,
  type User,
  type CustomTag,
} from "../api/models";
import {
  validateFoodDraft,
  foodEditBody,
  boundedText,
  restaurantAddressLimit,
} from "../api/content-rules";
// Domain data is persisted only by the isolated demo transport. Recovery secrets,
// command proofs and device tokens stay in this module's memory.
type Row = Record<string, any>;
export type DemoV4 = {
  feedback: Row[];
  reviewResults?: Record<string, Row>;
  submissions: Row[];
  cards: Row[];
  topics: Row[];
  favorites: number[];
  dismissedShops?: Record<number, Record<number, number>>;
  exposure?: DemoExposure;
  ratings: Record<string, string>;
  /** 店铺场景评价：`${restaurantId}:${scene}` -> RECOMMEND / NOT_RECOMMEND */
  sceneRatings: Record<string, string>;
  settings: Row;
  announcements: Row[];
  versions: Row[];
  audit: Row[];
  configVersion: number;
  telemetry: Row;
  events: string[];
  pushSettings: Row[];
  recoveries?: Record<string, Row>;
};
type Context = {
  v4?: DemoV4;
  user: User;
  foods: Food[];
  blocked?: number[];
  personalized?: boolean;
  restaurants: Restaurant[];
  tags: CustomTag[];
};
export function dismissedShopIds(s: Context) {
  const expiries = readSession() && s.v4?.dismissedShops?.[s.user.id ?? 10];
  const now = Date.now();
  return new Set(
    Object.entries(expiries ?? {})
      .filter(([, until]) => until > now)
      .map(([id]) => Number(id)),
  );
}
const now = () => new Date().toISOString(),
  later = (ms = 600_000) => new Date(Date.now() + ms).toISOString();
const secretCommands = new Map<string, Row>(),
  pushCommands = new Map<string, Row>(),
  bindings = new Map<string, Row>(),
  dedup = new Map<string, { body: string; data: unknown }>();
const subjectId = "11111111-1111-4111-8111-000000000010";
const categories = ["COMMENTS", "LIKES_AND_FAVORITES", "FOLLOWS", "SYSTEM"];
const flags = () =>
  Object.fromEntries(
    ["publish", "newShop", "comment", "push", "topic"].map((k) => [
      k,
      { on: true, reason: null },
    ]),
  );
function fail(message: string, status = 400): never {
  throw new ApiError(message, status, status);
}
function requireRow<T>(value: T | undefined | null): T {
  if (value == null) fail("记录不存在或当前不可见。", 404);
  return value;
}
function revision(expected: unknown, actual: unknown) {
  if (expected !== actual)
    fail("内容已被更新，请重新读取并比较后再提交。", 409);
}
function page(rows: unknown[], q: Query) {
  const p = Math.max(1, Number(q.page) || 1),
    size = Math.min(100, Math.max(1, Number(q.pageSize) || 12));
  return {
    items: rows.slice((p - 1) * size, p * size),
    currentPage: p,
    totalItems: rows.length,
    totalPages: Math.ceil(rows.length / size),
    hasNext: p * size < rows.length,
  };
}
function once(
  scope: string,
  id: unknown,
  body: unknown,
  action: () => unknown,
) {
  if (!id || typeof id !== "string") fail("缺少命令标识。", 400);
  const key = scope + ":" + id,
    text = JSON.stringify(body),
    previous = dedup.get(key);
  if (previous) {
    if (previous.body !== text) fail("同一命令不能提交不同内容。", 409);
    return previous.data;
  }
  const data = action();
  dedup.set(key, { body: text, data: structuredClone(data) });
  return data;
}
export function seedV4(): DemoV4 {
  return {
    feedback: [],
    submissions: [],
    cards: [],
    topics: [
      {
        id: 1,
        gid: crypto.randomUUID(),
        revision: 1,
        campusId: 1,
        name: "校园暖心饭",
        introduction: "天气转凉，一起收藏热乎的校园好味道。",
        startsAt: new Date(Date.now() - 86_400_000).toISOString(),
        endsAt: later(30 * 86_400_000),
        coverFoodId: 1,
        foodIds: [1, 2, 3],
        state: "PUBLISHED",
      },
    ],
    favorites: [],
    ratings: {},
    sceneRatings: {},
    settings: {
      revision: 1,
      flags: flags(),
      params: {},
      maintenance: { mode: "NONE", message: null, until: null },
      updatedAt: now(),
      updatedBy: 10,
    },
    announcements: [
      {
        id: 1,
        revision: 1,
        level: "NORMAL",
        title: "欢迎体验校园美食",
        content: "这是隔离 Mock 的公告，可在管理后台修改。",
        linkUrl: null,
        enabled: true,
        platforms: [],
        campusIds: [],
        minBuild: null,
        maxBuild: null,
        startsAt: null,
        endsAt: null,
        createdAt: now(),
        updatedAt: now(),
        updatedBy: 10,
      },
    ],
    versions: ["web", "android", "ios"].map((platform) => ({
      platform,
      revision: 1,
      minBuild: 0,
      latestBuild: 0,
      latestVersionName: null,
      storeUrl: null,
      releaseNotes: null,
      updatedAt: now(),
      updatedBy: 10,
    })),
    audit: [],
    configVersion: 1,
    telemetry: {
      enabled: false,
      policyVersion: "analytics-minimal-20261030",
      revision: 1,
      retentionDays: 30,
    },
    events: [],
    pushSettings: categories.map((category) => ({
      category,
      enabled: true,
      revision: 1,
      closeFrontier: null,
    })),
  };
}
export function handleV4(
  s: Context,
  path: string,
  o: RequestOptions,
  proofHash?: string,
): { data: unknown; code?: number } | undefined {
  const v = (s.v4 ??= seedV4()),
    q = o.query ?? {},
    b = (o.body ?? {}) as Row,
    m = o.method ?? "GET";
  // Drop the retired flag from demo records saved under the previous contract.
  delete v.settings.flags.autoCutout;
  const presentedProof =
    proofHash ??
    b.recoveryCapability ??
    o.headers?.["X-Recovery-Capability"] ??
    o.headers?.["X-Lifecycle-Recovery"];
  for (const [key, row] of Object.entries(v.recoveries ?? {}))
    if (!secretCommands.has(key))
      secretCommands.set(key, {
        ...row,
        capability: row.capabilityHash,
        hashed: true,
      });
  const persona =
      new URLSearchParams(location.search).get("persona") ?? "verified",
    admin = persona === "admin",
    user = s.user.id ?? 10;
  const ok = (data: unknown) => ({ data });
  if (
    /^\/admin\/(feedback|moderation|remote-config|topics)(\/|$)/.test(path) &&
    !admin
  )
    fail("此操作需要管理员身份。", 403);
  const adminCase = (c: Row) => ({
    view: viewCase(c),
    submitterId: c.submitterId ?? user,
    submissionDevice: c.submissionDevice ?? null,
    targetName:
      c.target?.type === "FOOD"
        ? (s.foods.find((f) => f.id === c.target.id)?.name ?? null)
        : c.target?.type === "RESTAURANT"
          ? (s.restaurants.find((r) => r.id === c.target.id)?.name ?? null)
          : null,
    targetUnavailable: false,
    catalogChangeRequired:
      c.kind === "CATALOG_ERROR" && c.outcome === "ACCEPTED",
    actions:
      c.status === "CLOSED"
        ? [
            {
              decisionId: c.decisionId,
              outcome: c.outcome,
              reply: c.reply,
              internalNote: c.internalNote ?? "",
              operatorId: 10,
              createdAt: c.closedAt,
            },
          ]
        : [],
  });
  const viewCase = (c: Row) => {
    const { decisionId, internalNote, submissionDevice, submitterId, ...view } = c;
    return { ...view, category: view.kind === "FEEDBACK" ? view.category ?? "OTHER" : null };
  };
  const addCard = (
    kind: string,
    domain: string,
    id: number,
    gid: string,
    detail: Row,
  ) => {
    const target = { domain, id, gid, unavailable: false },
      day = new Date().toISOString().slice(0, 10);
    v.cards.unshift({
      id: crypto.randomUUID(),
      column: "SYSTEM",
      kind,
      target,
      day,
      memberCount: 1,
      unreadMemberCount: 1,
      latestAt: Date.now(),
      actors: [],
      data: { schema: 1, kind, target, day, memberCount: 1, detail },
    });
  };
  if (
    [
      "/feedback/messages",
      "/feedback/reports",
      "/feedback/catalog-errors",
    ].includes(path)
  )
    return ok(
      once(path, o.headers?.["Idempotency-Key"], b, () => {
        const kind = path.endsWith("messages")
          ? "FEEDBACK"
          : path.endsWith("reports")
            ? "REPORT"
            : "CATALOG_ERROR";
        if (kind === "FEEDBACK" && !String(b.text ?? "").trim())
          fail("请填写反馈内容。");
        if (
          (b.screenshotKeys ?? []).length > 3 ||
          (b.screenshotKeys ?? []).some(
            (k: string) => !k.startsWith("feedback/"),
          )
        )
          fail("反馈截图格式不正确。");
        const target =
          kind === "CATALOG_ERROR"
            ? { type: "RESTAURANT", id: b.restaurantId }
            : kind === "REPORT"
              ? { type: b.targetType, id: b.targetId }
              : (b.context ?? null);
        if (kind !== "FEEDBACK" && (!target?.id || !target.type))
          fail("缺少关联对象。");
        const c = {
          id: Math.max(0, ...v.feedback.map((x) => x.id)) + 1,
          gid: crypto.randomUUID(),
          kind,
          submitterId: user,
          ...demoFeedbackFields(kind, b.category),
          status: "OPEN",
          target,
          reason: b.errorType ?? b.reason ?? null,
          text: b.text ?? b.note ?? "",
          screenshots: (b.screenshotKeys ?? []).map(
            (key: string, slot: number) => ({
              slot,
              url: mediaUrl(key),
              expiresInSeconds: 300,
            }),
          ),
          outcome: null,
          reply: "",
          createdAt: Date.now(),
          closedAt: null,
        };
        v.feedback.unshift(c);
        return { id: c.id, gid: c.gid, status: c.status };
      }),
    );
  if (path === "/feedback/mine")
    return ok(
      page(
        v.feedback
          .filter((x) => !q.status || x.status === q.status)
          .filter((x) => !q.kind || x.kind === q.kind)
          .filter((x) => (x.submitterId ?? user) === user)
          .map(viewCase),
        q,
      ),
    );
  if (/^\/feedback\/mine\/\d+$/.test(path))
    return ok(
      viewCase(
        requireRow(
          v.feedback.find((x) => x.id === Number(path.split("/").pop()) && (x.submitterId ?? user) === user),
        ),
      ),
    );
  if (path === "/admin/feedback/cases/counts") {
    const open = (kind: string) =>
      v.feedback.filter((x) => x.status === "OPEN" && x.kind === kind).length;
    return ok({
      total: v.feedback.filter((x) => x.status === "OPEN").length,
      feedback: open("FEEDBACK"),
      catalogError: open("CATALOG_ERROR"),
      report: open("REPORT"),
    });
  }
  if (path === "/admin/feedback/cases")
    return ok(
      page(
        v.feedback
          .filter((x) => !q.status || x.status === q.status)
          .filter((x) => !q.kind || x.kind === q.kind)
          .filter((x) => !q.category || (x.kind === "FEEDBACK" && (x.category ?? "OTHER") === q.category))
          .filter((x) => !q.submitterId || (x.submitterId ?? user) === Number(q.submitterId))
          .filter((x) => !q.appVersion || x.submissionDevice?.appVersion === q.appVersion)
          .map(adminCase),
        q,
      ),
    );
  if (/^\/admin\/feedback\/cases\/\d+$/.test(path))
    return ok(
      adminCase(
        requireRow(
          v.feedback.find((x) => x.id === Number(path.split("/").pop())),
        ),
      ),
    );
  if (/^\/admin\/feedback\/cases\/\d+\/resolution$/.test(path))
    return ok(
      once(path, o.headers?.["Idempotency-Key"], b, () => {
        const c = requireRow(
          v.feedback.find((x) => x.id === Number(path.split("/")[4])),
        );
        if (c.status !== "OPEN") fail("该反馈已处理。", 409);
        if (
          ![
            "ACCEPTED",
            "REJECTED",
            ...(c.kind === "FEEDBACK" ? ["RESOLVED"] : []),
          ].includes(b.outcome)
        )
          fail("处理结论不适用。");
        Object.assign(c, {
          status: "CLOSED",
          outcome: b.outcome,
          reply: b.reply ?? "",
          internalNote: b.internalNote ?? "",
          decisionId: o.headers?.["Idempotency-Key"],
          closedAt: Date.now(),
        });
        addCard("case_result", "feedback", c.id, c.gid, {
          type: "case_result",
          caseId: c.id,
          kind: c.kind,
          reasonCode: c.reason,
          outcome: c.outcome,
          reply: c.reply,
        });
        return {
          id: c.id,
          decisionId: c.decisionId,
          status: c.status,
          outcome: c.outcome,
          notified: true,
          catalogChangeRequired:
            c.kind === "CATALOG_ERROR" && c.outcome === "ACCEPTED",
        };
      }),
    );
  const topicSummary = (t: Row) => {
    const foods = s.foods.filter((f) => t.foodIds.includes(f.id));
    return {
      id: t.id,
      gid: t.gid,
      revision: t.revision,
      campusId: t.campusId,
      name: t.name,
      introduction: t.introduction,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      coverFoodId: foods.some((f) => f.id === t.coverFoodId)
        ? t.coverFoodId
        : null,
      visibleFoodCount: foods.length,
    };
  };
  if (path === "/topics/current") {
    const t = v.topics.find(
      (t) =>
        t.state === "PUBLISHED" &&
        t.campusId === Number(q.campusId) &&
        Date.parse(t.startsAt) <= Date.now() &&
        Date.parse(t.endsAt) > Date.now(),
    );
    return ok(t ? topicSummary(t) : null);
  }
  if (path === "/topics/history")
    return ok(
      page(
        v.topics
          .filter(
            (t) =>
              t.campusId === Number(q.campusId) &&
              (admin || t.state === "PUBLISHED"),
          )
          .map(topicSummary),
        q,
      ),
    );
  if (/^\/topics\/by-food\/\d+$/.test(path))
    return ok(
      v.topics
        .filter(
          (t) =>
            t.state === "PUBLISHED" &&
            t.foodIds.includes(Number(path.split("/").pop())),
        )
        .map(topicSummary),
    );
  if (/^\/topics\/\d+$/.test(path)) {
    const t = requireRow(
      v.topics.find(
        (t) =>
          t.id === Number(path.split("/").pop()) &&
          (admin || t.state === "PUBLISHED"),
      ),
    );
    return ok({
      topic: topicSummary(t),
      foods: t.foodIds
        .map((id: number) => s.foods.find((f) => f.id === id))
        .filter(Boolean),
    });
  }
  if (path === "/admin/topics/commands")
    return ok(
      once(path, b.commandId, b, () => {
        const e = b.edit as Row;
        if (
          !e?.topicId ||
          !e.campusId ||
          !String(e.name ?? "").trim() ||
          !Number.isFinite(Date.parse(e.startsAt)) ||
          Date.parse(e.endsAt) <= Date.parse(e.startsAt)
        )
          fail("请完整填写专题及有效时间范围。");
        if (
          !Array.isArray(e.foodIds) ||
          e.foodIds.length > 20 ||
          new Set(e.foodIds).size !== e.foodIds.length ||
          e.foodIds.some((id: number) => !s.foods.some((f) => f.id === id))
        )
          fail("专题菜品不正确。");
        if (e.coverFoodId && !e.foodIds.includes(e.coverFoodId))
          fail("封面需要属于专题菜品。");
        let t = v.topics.find((x) => x.gid === e.topicId);
        revision(e.expectedRevision, t?.revision ?? 0);
        if (!t) {
          t = {
            id: Math.max(0, ...v.topics.map((x) => x.id)) + 1,
            gid: e.topicId,
            revision: 0,
          };
          v.topics.unshift(t);
        }
        Object.assign(t, e, {
          gid: e.topicId,
          revision: t.revision + 1,
          state:
            b.operation === "PUBLISH"
              ? "PUBLISHED"
              : b.operation === "WITHDRAW"
                ? "WITHDRAWN"
                : "DRAFT",
        });
        return {
          commandId: b.commandId,
          topicId: t.gid,
          numericId: t.id,
          revision: t.revision,
          state: t.state,
        };
      }),
    );
  const submitView = (x: Row) => {
    const { images, owner, isNew, ...view } = x;
    return view;
  };
  if (
    path === "/foods/upload" ||
    path === "/restaurant/add" ||
    /^\/foods\/(my\/)?edit\/\d+$/.test(path) ||
    /^\/restaurant\/edit\/\d+$/.test(path)
  ) {
    if (persona === "unverified" && !admin) fail("请先完成学生认证。", 403);
    const kind = path.startsWith("/foods/") ? "FOOD" : "RESTAURANT",
      isNew = path.endsWith("upload") || path.endsWith("add"),
      id = isNew
        ? Math.max(
            100,
            ...(kind === "FOOD" ? s.foods : s.restaurants).map(
              (x) => x.id ?? 0,
            ),
            ...v.submissions.filter((x) => x.kind === kind).map((x) => x.id),
          ) + 1
        : Number(path.split("/").pop());
    const original = isNew
      ? undefined
      : requireRow(
          (kind === "FOOD" ? s.foods : s.restaurants).find((x) => x.id === id),
        );
    if (!admin && original?.accountId != null && original.accountId !== user)
      fail("只能编辑自己的内容。", 403);
    if (kind === "FOOD") {
      if (isNew)
        validateFoodDraft({
          name: b.name,
          description: b.description ?? "",
          price: String(b.price ?? ""),
          tags: b.myCustomTagNames ?? [],
        });
      else foodEditBody(original as Food, b);
    } else {
      if (isNew || b.name != null) boundedText(b.name ?? "", 20, "店名");
      if (isNew || b.address != null) boundedText(b.address ?? "", restaurantAddressLimit, "地址");
    }
    const images = b.pictureUrl ?? b.pictureKeys ?? original?.pictureUrl ?? [];
    if (
      isNew &&
      ((kind === "FOOD" && !images.length) ||
        images.length > (kind === "FOOD" ? 9 : 1))
    )
      fail("请上传符合数量要求的照片。");
    const candidate: Row = { ...(original ?? {}), ...b };
    for (const key of ["pictureUrl", "pictureKeys", "coverUrl", "accountId"])
      delete candidate[key];
    v.submissions
      .filter(
        (x) =>
          x.id === id && x.kind === kind && x.moderationStatus === "PENDING",
      )
      .forEach((x) =>
        Object.assign(x, {
          moderationStatus: "SUPERSEDED",
          reasonCode: "NEWER_SUBMISSION",
          resolvedAt: now(),
        }),
      );
    const sub = {
      id,
      kind,
      objectGid: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      moderationStatus: "PENDING",
      reasonCode: null,
      reasonMessage: null,
      submittedAt: now(),
      resolvedAt: null,
      candidate,
      imageCount: images.length,
      images,
      owner: user,
      isNew,
    };
    v.submissions.unshift(sub);
    return ok({ id, moderationStatus: "PENDING", revisionId: sub.revisionId });
  }
  if (
    path === "/moderation/submissions/my" ||
    path === "/admin/moderation/queue"
  )
    return ok(
      page(
        v.submissions
          .filter((x) =>
            path.startsWith("/admin/")
              ? !q.status
                ? x.moderationStatus === "PENDING"
                : x.moderationStatus === q.status
              : x.owner === user,
          )
          .filter((x) => !q.kind || x.kind === q.kind)
          .map(submitView),
        q,
      ),
    );
  if (
    /^\/(moderation\/submissions|admin\/moderation\/revisions)\/[^/]+(\/images\/\d+)?$/.test(
      path,
    )
  ) {
    const parts = path.split("/"),
      offset = path.startsWith("/admin/") ? 4 : 3,
      sub = requireRow(
        v.submissions.find((x) => x.revisionId === parts[offset]),
      );
    if (!admin && sub.owner !== user) fail("无权查看该提交。", 403);
    if (parts.includes("images")) {
      const slot = Number(parts.at(-1)),
        key = requireRow(sub.images[slot]);
      return ok({
        slot,
        url: mediaUrl(key) ?? "/prototype/assets/dishes/yangzhi.svg",
        expiresInSeconds: 60,
      });
    }
    return ok(submitView(sub));
  }
  if (path === "/admin/moderation/reviews") {
    const key = JSON.stringify([b.revisionId, b.verdict, b.reasonCode]),
      previous = v.reviewResults?.[key];
    if (previous)
      return ok({
        ...previous,
        state:
          previous.state === "PUBLISHED" ? "ALREADY_PUBLISHED" : previous.state,
      });
    const sub = requireRow(
        v.submissions.find((x) => x.revisionId === b.revisionId),
      ),
      states: Row = {
        APPROVE: "APPROVED",
        REJECT: "REJECTED",
        HIDE: "HIDDEN",
        RESTORE: "APPROVED",
        DELETE: "DELETED",
      };
    if (!states[b.verdict]) fail("审核结论不正确。");
    if (
      ["APPROVE", "REJECT"].includes(b.verdict) &&
      sub.moderationStatus !== "PENDING"
    )
      fail("提交已被处理，请刷新。", 409);
    sub.moderationStatus = states[b.verdict];
    sub.reasonCode = b.reasonCode || null;
    sub.reasonMessage = b.reasonCode || null;
    sub.resolvedAt = now();
    const list = sub.kind === "FOOD" ? s.foods : s.restaurants,
      index = list.findIndex((x) => x.id === sub.id);
    if (sub.moderationStatus === "APPROVED") {
      const record = {
        ...(index < 0 ? {} : list[index]),
        ...sub.candidate,
        id: sub.id,
        accountId: sub.owner,
        pictureUrl: sub.images,
        createdAt: Date.parse(sub.submittedAt),
        updatedAt: Date.now(),
      };
      if (sub.kind === "FOOD") {
        const r = s.restaurants.find((x) => x.id === record.restaurantId);
        Object.assign(record, {
          restaurantName: r?.name,
          likesCount: record.likesCount ?? 0,
          uploaderName: s.user.displayName,
        });
        if (record.myCustomTagNames) {
          record.myCustomTags = record.myCustomTagNames.map((name: string) => {
            let tag = s.tags.find((t) => t.name === name);
            if (!tag) {
              tag = {
                id: Math.max(0, ...s.tags.map((t) => t.id ?? 0)) + 1,
                name,
              };
              s.tags.push(tag);
            }
            return { id: tag.id, name: tag.name };
          });
        }
      }
      if (index < 0) list.push(record);
      else Object.assign(list[index], record);
    } else if (
      ["HIDDEN", "DELETED"].includes(sub.moderationStatus) &&
      index >= 0
    )
      list.splice(index, 1);
    addCard(
      "moderation_result",
      sub.kind === "FOOD" ? "foods" : "restaurant",
      sub.id,
      sub.objectGid,
      {
        type: "moderation_result",
        targetDomain: sub.kind,
        targetId: sub.id,
        revisionId: sub.revisionId,
        verdict: b.verdict,
        reasonCode: sub.reasonCode,
      },
    );
    const result = {
      decisionId: crypto.randomUUID(),
      state: sub.moderationStatus === "REJECTED" ? "REJECTED" : "PUBLISHED",
    };
    (v.reviewResults ??= {})[key] = result;
    return ok(result);
  }
  if (path === "/notification/cards")
    return ok(
      page(
        v.cards.filter(
          (c) =>
            !q.column ||
            q.column === "ALL" ||
            c.column === q.column ||
            (q.column === "INTERACTION" &&
              ["LIKES_AND_FAVORITES", "FOLLOWS"].includes(c.column)),
        ),
        q,
      ),
    );
  if (path === "/notification/cards/unread/count")
    return ok({
      cards: v.cards.filter((c) => c.unreadMemberCount > 0).length,
      members: v.cards.reduce((n, c) => n + c.unreadMemberCount, 0),
    });
  if (/^\/notification\/cards\/[^/]+\/read$/.test(path)) {
    requireRow(
      v.cards.find((c) => c.id === path.split("/")[3]),
    ).unreadMemberCount = 0;
    return ok(null);
  }
  if (/^\/foods\/tags\/my\/\d+\/foods$/.test(path)) {
    const id = Number(path.split("/")[4]);
    if (!s.tags.some((t) => t.id === id)) fail("标签不存在或不属于你。", 404);
    return ok(
      page(
        s.foods.filter((f) => f.myCustomTags?.some((t) => t.id === id)),
        q,
      ),
    );
  }
  const sceneStat = (
    id: number,
    scene: "dine_in" | "delivery",
    count: number,
    rate: number,
  ) => {
    const vote = v.sceneRatings?.[`${id}:${scene}`];
    const score = (vote ?? v.ratings[String(id)]) as string | undefined;
    if (!score) return { rate, count };
    const nextCount = count + 1;
    const recommended = score === "RECOMMEND" ? 1 : 0;
    return {
      rate: (rate * count + recommended) / nextCount,
      count: nextCount,
    };
  };
  if (path === "/recommend/tags")
    return ok({ categories: shopCategories, tags: tasteTags, dislikableTags });
  const dismiss = m === "POST" && path.match(/^\/recommend\/dismiss\/(\d+)$/);
  if (dismiss) {
    if (!readSession()) throw new ApiError("请先登录。", 20001, 401);
    const id = Number(dismiss[1]);
    if (!s.restaurants.some((shop) => shop.id === id))
      throw new ApiError("店铺不存在。", 40009);
    const byUser = (v.dismissedShops ??= {});
    const expiries = (byUser[user] ??= {});
    expiries[id] = Date.now() + 30 * 86_400_000;
    return ok(null);
  }
  const restaurant = (r: Restaurant & V2Shop) => {
    const foods = s.foods.filter((f) => f.restaurantId === r.id),
      prices = foods
        .map((f) => f.price)
        .filter((p): p is number => p != null)
        .sort((a, b) => a - b),
      median = prices.length
        ? (prices[Math.floor((prices.length - 1) / 2)] +
            prices[Math.floor(prices.length / 2)]) /
          2
        : null;
    return {
      ...r,
      permanentlyClosed: r.permanentlyClosed ?? false,
      operatingStatus: r.permanentlyClosed ? "CLOSED" : "OPEN",
      distanceMeters:
        q.gcjLat == null
          ? null
          : Math.round(
              Math.hypot(
                (r.gcjLng ?? 0) - Number(q.gcjLng),
                (r.gcjLat ?? 0) - Number(q.gcjLat),
              ) * 90_000,
            ),
      campusId: 1,
      hubName: "软件园校区",
      visibleFoodCount: foods.length,
      medianPrice: median,
      priceBand: r.priceBand !== undefined ? r.priceBand :
        median == null
          ? null
          : median < 15
            ? "UNDER_15"
            : median <= 30
              ? "FROM_15_TO_30"
              : "OVER_30",
      ratingCount: v.ratings[String(r.id)] ? 6 : 5,
      recommendationRate: v.ratings[String(r.id)] === "NOT_RECOMMEND" ? 67 : 80,
      isFavorite: v.favorites.includes(r.id!),
      ratingSummaryState: "READY",
      personalState: "READY",
      publicTastesState: "READY",
      myRating: v.ratings[String(r.id)] ?? null,
      myRatings: {
        dineIn: v.sceneRatings?.[`${r.id}:dine_in`] ?? null,
        delivery: v.sceneRatings?.[`${r.id}:delivery`] ?? null,
      },
      dineIn: sceneStat(r.id!, "dine_in", 5, 0.8),
      ...("deliveryEnabled" in r && r.deliveryEnabled
        ? { delivery: sceneStat(r.id!, "delivery", 3, 0.72) }
        : {}),
      signatureFoods: [...foods]
        .sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0))
        .slice(0, 3),
      matchedFoods: q.keyword
        ? foods.filter((f) => f.name?.includes(String(q.keyword))).slice(0, 3)
        : [],
      publicTastes: [],
      coverUrl: foods[0]?.pictureUrl?.[0] ?? null,
      stageColor: foods[0]?.stageColor ?? null,
    };
  };
  if ((path === "/foods/recommend" && q.kind) || path === "/recommend/pick") {
    const mealTime = String(q.mealTime ?? mealSlotAt(Date.now()));
    const dismissed = dismissedShopIds(s);
    const eligible = s.foods.filter((food: Food & V2Food) =>
      !s.blocked?.includes(food.accountId ?? 0) &&
      (!q.mealTime || !food.mealTimes?.length || food.mealTimes.some((meal) => meal === q.mealTime)) &&
      (q.scene !== "delivery" || food.deliveryEnabled !== false)
    );
    const shops = s.restaurants
      .filter((shop) => !dismissed.has(shop.id ?? 0))
      .map(restaurant)
      .filter((shop) => (shop.kind ?? "food") === (q.kind ?? "food") && !shop.permanentlyClosed &&
        (q.scene !== "delivery" || shop.deliveryEnabled !== false))
      .map((shop) => ({
        ...shop,
        signatureFoods: eligible.filter((food) => food.restaurantId === shop.id).slice(0, 3)
          .map((food) => ({ ...food, coverUrl: food.pictureUrl?.[0] })),
      }));
    const pick = path === "/recommend/pick";
    const batch = demoRecommendationPage(shops, v.exposure ??= {},
      readSession() && s.personalized !== false ? user : undefined, mealTime, Number(q.page ?? 1), 20, pick);
    if (pick) {
      const card = batch.items[0];
      return ok({
        mealTime,
        restaurant: card ? {
          ...card,
          signatureFoods: card.signatureFoods.map((dish) => ({
            ...dish, pictureUrl: dish.coverUrl ?? null,
          })),
        } : null,
      });
    }
    const ids = new Set(batch.items.map((shop) => shop.id));
    return ok({ ...batch, mealTime, shops: batch.items, items: eligible.filter((food) => ids.has(food.restaurantId)).slice(0, Number(q.size ?? 8)) });
  }
  if (
    [
      "/restaurant/favorites",
      "/restaurant/browse",
      "/restaurant/search",
    ].includes(path)
  ) {
    let rows = s.restaurants
      .map(restaurant)
      .filter((r) => path !== "/restaurant/favorites" || r.isFavorite)
      .filter((r) => !q.favoritesOnly || r.isFavorite)
      .filter((r) => !q.hubId || r.hubId === Number(q.hubId))
      .filter((r) => !q.campusId || r.campusId === Number(q.campusId))
      .filter(
        (r) =>
          !q.keyword ||
          r.name?.includes(String(q.keyword)) ||
          r.address?.includes(String(q.keyword)) ||
          r.matchedFoods.length,
      )
      .filter((r) => !q.kind || r.kind === q.kind)
      .filter((r) => !q.priceBand || r.priceBand === q.priceBand)
      .filter(
        (r) =>
          !q.recommendedOnly ||
          [r.dineIn, r.delivery].some(
            (stat) => (stat?.count ?? 0) >= 3 && (stat?.rate ?? 0) >= 0.7,
          ),
      )
      .filter(
        (r) =>
          !q.categories ||
          r.categories?.some((category) =>
            Array.isArray(q.categories)
              ? q.categories.includes(category)
              : q.categories === category,
          ),
      );
    rows.sort((a, b) =>
      q.sort === "FOOD_COUNT"
        ? b.visibleFoodCount - a.visibleFoodCount
        : q.sort === "NEWEST"
          ? (b.createdAt ?? 0) - (a.createdAt ?? 0)
          : q.sort === "RECOMMENDATION_RATE"
            ? (b.recommendationRate ?? -1) - (a.recommendationRate ?? -1)
            : q.sort === "DISTANCE"
              ? (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)
              : 0,
    );
    return ok(page(rows, q));
  }
  if (/^\/restaurant\/detail\/\d+$/.test(path))
    return ok(
      restaurant(
        requireRow(
          s.restaurants.find((r) => r.id === Number(path.split("/").pop())),
        ),
      ),
    );
  if (/^\/restaurant\/\d+\/(favorite|rating)$/.test(path)) {
    const id = Number(path.split("/")[2]);
    requireRow(s.restaurants.find((r) => r.id === id));
    if (persona === "unverified" && m === "PUT")
      fail("请先完成学生认证。", 403);
    if (path.endsWith("favorite")) {
      v.favorites = v.favorites.filter((x) => x !== id);
      if (m === "PUT") v.favorites.push(id);
      return ok({ isFavorite: m === "PUT" });
    }
    const scene = (b.scene ?? q.scene) as "dine_in" | "delivery" | undefined;
    v.sceneRatings ??= {};
    if (m === "DELETE") {
      if (scene) delete v.sceneRatings[`${id}:${scene}`];
      else {
        delete v.ratings[String(id)];
        delete v.sceneRatings[`${id}:dine_in`];
        delete v.sceneRatings[`${id}:delivery`];
      }
    } else {
      if (!["RECOMMEND", "GOOD", "AVERAGE", "NOT_RECOMMEND"].includes(b.rating))
        fail("请选择评价。");
      if (scene) v.sceneRatings[`${id}:${scene}`] = b.rating;
      else v.ratings[String(id)] = b.rating;
    }
    return ok({
      rating: v.ratings[String(id)] ?? null,
      myRatings: {
        dineIn: v.sceneRatings[`${id}:dine_in`] ?? null,
        delivery: v.sceneRatings[`${id}:delivery`] ?? null,
      },
    });
  }
  const audit = (
    action: string,
    target: string,
    id: string,
    rev: number,
    before: Row | null = null,
    after: Row = {},
  ) => {
    const clean = (value: Row | null) => {
      if (!value) return null;
      const { updatedBy, ...snapshot } = structuredClone(value);
      return snapshot;
    };
    v.configVersion++;
    v.audit.unshift({
      id: v.audit.length + 1,
      occurredAt: now(),
      adminId: 10,
      target: target === "VERSION" ? "VERSION_LINE" : target,
      targetKey: id,
      action: action.startsWith("SAVE") ? "UPDATE" : action,
      revisionBefore: action === "CREATE" ? null : rev - 1,
      revisionAfter: rev,
      configVersion: v.configVersion,
      before: action === "CREATE" ? null : { revision: rev - 1 },
      after: { revision: rev },
    });
  };
  if (path === "/remote-config") {
    const platform = String(q.platform ?? "web"),
      build = Number(q.build ?? 0),
      line = requireRow(v.versions.find((x) => x.platform === platform));
    const announcements = v.announcements
      .filter(
        (a) =>
          a.enabled &&
          (!a.startsAt || Date.parse(a.startsAt) <= Date.now()) &&
          (!a.endsAt || Date.parse(a.endsAt) > Date.now()) &&
          (!a.platforms.length || a.platforms.includes(platform)) &&
          (!a.campusIds.length || a.campusIds.includes(Number(q.campusId))) &&
          (a.minBuild == null || (q.build != null && build >= a.minBuild)) &&
          (a.maxBuild == null || (q.build != null && build <= a.maxBuild)),
      )
      .sort(
        (a, b) =>
          (a.level === "IMPORTANT" ? -1 : 1) -
            (b.level === "IMPORTANT" ? -1 : 1) || b.id - a.id,
      )
      .slice(0, 20)
      .map((a) => ({
        id: a.id,
        level: a.level,
        title: a.title,
        content: a.content,
        linkUrl: a.linkUrl,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
      }));
    return ok({
      configVersion: v.configVersion,
      flags: v.settings.flags,
      params: v.settings.params,
      maintenance: v.settings.maintenance,
      announcements,
      versions: Object.fromEntries(
        v.versions.map(({ revision, updatedAt, updatedBy, ...x }) => [
          x.platform,
          x,
        ]),
      ),
      update:
        q.build == null
          ? null
          : {
              ...line,
              build,
              decision:
                build < line.minBuild
                  ? "FORCE"
                  : build < line.latestBuild
                    ? "SUGGEST"
                    : "NONE",
            },
    });
  }
  if (path === "/admin/remote-config")
    return ok({
      siteMode: "single",
      configVersion: v.configVersion,
      settings: v.settings,
      versions: v.versions,
    });
  if (path === "/admin/remote-config/settings") {
    revision(b.expectedRevision, v.settings.revision);
    const before = structuredClone(v.settings);
    Object.assign(v.settings, {
      flags: { ...flags(), ...b.flags },
      params: b.params,
      maintenance: { message: null, until: null, ...b.maintenance },
      revision: v.settings.revision + 1,
      updatedAt: now(),
      updatedBy: 10,
    });
    audit(
      "SAVE_SETTINGS",
      "SETTINGS",
      "settings",
      v.settings.revision,
      before,
      v.settings,
    );
    return ok(v.settings);
  }
  if (/^\/admin\/remote-config\/versions\/[^/]+$/.test(path)) {
    const line = requireRow(
      v.versions.find((x) => x.platform === path.split("/").pop()),
    );
    revision(b.expectedRevision, line.revision);
    const before = structuredClone(line);
    if (b.minBuild > b.latestBuild) fail("最低构建号不能大于最新构建号。");
    const { expectedRevision, ...value } = b;
    Object.assign(line, value, {
      revision: line.revision + 1,
      updatedAt: now(),
      updatedBy: 10,
    });
    audit(
      "SAVE_VERSION",
      "VERSION",
      line.platform,
      line.revision,
      before,
      line,
    );
    return ok(line);
  }
  if (path === "/admin/remote-config/audit") return ok(page(v.audit, q));
  if (path === "/admin/remote-config/announcements" && m === "GET")
    return ok(page(v.announcements, q));
  if (path === "/admin/remote-config/announcements" && m === "POST") {
    if (!String(b.content ?? "").trim()) fail("请填写公告正文。");
    const a = {
      id: Math.max(0, ...v.announcements.map((x) => x.id)) + 1,
      revision: 1,
      title: null,
      linkUrl: null,
      platforms: [],
      campusIds: [],
      minBuild: null,
      maxBuild: null,
      startsAt: null,
      endsAt: null,
      enabled: true,
      ...b,
      createdAt: now(),
      updatedAt: now(),
      updatedBy: 10,
    };
    v.announcements.unshift(a);
    audit("CREATE", "ANNOUNCEMENT", String(a.id), 1, null, a);
    return ok(a);
  }
  if (/^\/admin\/remote-config\/announcements\/\d+$/.test(path)) {
    const a = requireRow(
      v.announcements.find((x) => x.id === Number(path.split("/").pop())),
    );
    revision(
      m === "DELETE" ? q.expectedRevision : b.expectedRevision,
      a.revision,
    );
    const before = structuredClone(a);
    if (m === "DELETE") {
      v.announcements = v.announcements.filter((x) => x !== a);
      audit("DELETE", "ANNOUNCEMENT", String(a.id), a.revision + 1, before, {
        id: a.id,
        deleted: true,
        revision: a.revision + 1,
      });
      return ok(null);
    }
    const { expectedRevision, ...input } = b;
    Object.assign(a, input, {
      revision: a.revision + 1,
      updatedAt: now(),
      updatedBy: 10,
    });
    audit("UPDATE", "ANNOUNCEMENT", String(a.id), a.revision, before, a);
    return ok(a);
  }
  if (path === "/telemetry/consent") {
    if (m !== "GET") {
      revision(b.expectedRevision, v.telemetry.revision);
      if (b.policyVersion !== v.telemetry.policyVersion)
        fail("统计政策版本已变更，请重新读取。", 409);
      v.telemetry = {
        ...v.telemetry,
        enabled: m === "DELETE" ? false : b.enabled === true,
        revision: v.telemetry.revision + 1,
      };
      if (!v.telemetry.enabled) v.events = [];
    }
    return ok(v.telemetry);
  }
  if (path === "/telemetry/events") {
    if (!v.telemetry.enabled) fail("匿名使用统计尚未授权。", 403);
    revision(b.consentRevision, v.telemetry.revision);
    if (!Array.isArray(b.events) || b.events.length > 50)
      fail("事件批次不正确。");
    let accepted = 0,
      duplicates = 0;
    for (const event of b.events) {
      if (
        !event.eventId ||
        (event.properties?.event === "page_view"
          ? !telemetryPages.includes(event.properties.page) ||
            Object.keys(event.properties).length !== 2
          : Object.keys(event.properties ?? {}).join() !== "event") ||
        ![
          "app_open",
          "page_view",
          "dish_shuffle",
          "dish_decide",
          "navigate_shop",
          "publish_success",
          "comment_success",
          "verify_success",
          "share",
          "load_failed",
        ].includes(event.properties.event)
      )
        fail("事件包含未允许的字段。");
      if (v.events.includes(event.eventId)) duplicates++;
      else {
        v.events.push(event.eventId);
        accepted++;
      }
    }
    return ok({ accepted, duplicates });
  }
  if (path === "/push/settings") return ok(v.pushSettings);
  if (path === "/push/commands/status") {
    const c = requireRow(pushCommands.get(b.commandId));
    if (c.owner !== user || (c.capability && c.capability !== b.capability))
      fail("命令凭据不正确。", 403);
    return ok(c.receipt);
  }
  if (path.startsWith("/push/") && m === "POST")
    return ok(
      once(path, b.commandId, b, () => {
        let binding: Row | undefined,
          state = "REGISTERED",
          closeFrontier = null,
          prefRevision = 0;
        if (path.includes("/settings/")) {
          const setting = requireRow(
            v.pushSettings.find((x) => x.category === b.category),
          );
          revision(b.expectedPreferenceRevision, setting.revision);
          if (
            path.endsWith("enable") &&
            b.observedCloseFrontier !== (setting.closeFrontier ?? undefined)
          )
            fail("栏目关闭状态已变更，请刷新。", 409);
          setting.enabled = path.endsWith("enable");
          setting.revision++;
          if (!setting.enabled) setting.closeFrontier = b.commandId;
          state = setting.enabled ? "ENABLED" : "CLOSED";
          closeFrontier = setting.closeFrontier;
          prefRevision = setting.revision;
        } else if (path === "/push/bindings") {
          if (!/^[A-Za-z0-9_-]{43}$/.test(b.capability ?? ""))
            fail("设备凭据格式不正确。");
          binding = {
            id: crypto.randomUUID(),
            owner: user,
            capability: b.capability,
            generation: 1,
            tokenGeneration: b.deviceToken ? 1 : 0,
            deviceToken: b.deviceToken,
          };
          bindings.set(binding.id, binding);
        } else {
          binding = requireRow(bindings.get(path.split("/")[3]));
          if (binding.capability !== b.capability || b.bindingId !== binding.id)
            fail("设备凭据不正确。", 403);
          revision(b.expectedGeneration, binding.generation);
          if (b.expectedTokenGeneration != null)
            revision(b.expectedTokenGeneration, binding.tokenGeneration);
          if (path.endsWith("/unbind")) {
            binding.generation++;
            state = "CLOSED";
          } else {
            binding.generation += path.endsWith("/transfer") ? 1 : 0;
            binding.tokenGeneration++;
            binding.owner = user;
            binding.deviceToken = b.deviceToken;
            state = "TOKEN_REFRESHED";
          }
        }
        const receipt = {
          commandId: b.commandId,
          bindingId: binding?.id ?? null,
          generation: binding?.generation ?? 0,
          tokenGeneration: binding?.tokenGeneration ?? 0,
          state,
          closeFrontier,
          preferenceRevision: prefRevision,
        };
        pushCommands.set(b.commandId, {
          owner: user,
          capability: b.capability,
          receipt,
        });
        return receipt;
      }),
    );
  const outcome = (id: string) => ({
    commandId: id,
    status: "READY",
    tokenName: "Authorization",
    tokenValue: "demo-v4-recovered",
    loginId: String(user),
    device: "web",
    expiresInSeconds: 3600,
    restricted: false,
  });
  const sessionDevices = [
    {
      sessionId: "11111111-1111-4111-8111-000000000001",
      device: "当前浏览器",
      issuedAt: now(),
      lastSeenAt: now(),
      expiresAt: later(3600_000),
      current: true,
    },
    {
      sessionId: "11111111-1111-4111-8111-000000000002",
      device: "另一台设备",
      issuedAt: now(),
      lastSeenAt: now(),
      expiresAt: later(3600_000),
      current: false,
    },
  ];
  if (path === "/auth/sessions")
    return ok({
      devices: sessionDevices.filter(
        (x) => !secretCommands.has("revoked:" + x.sessionId),
      ),
      nextCursor: null,
    });
  if (/^\/auth\/sessions\/[^/]+$/.test(path) && m === "DELETE") {
    secretCommands.set("revoked:" + path.split("/").pop(), {});
    return ok({ commandId: null, status: "PENDING" });
  }
  if (path === "/auth/sessions/revoke-others")
    return ok(
      once(path, b.commandId, b, () => {
        if (!b.recoveryCapability) fail("缺少恢复凭据。");
        secretCommands.set(b.commandId, {
          capability: presentedProof,
          hashed: !!proofHash,
          type: "devices",
          ready: false,
        });
        return { commandId: b.commandId, status: "PENDING" };
      }),
    );
  if (/^\/auth\/sessions\/[^/]+\/(status|resume)$/.test(path)) {
    const id = path.split("/")[3],
      c = requireRow(secretCommands.get(id));
    if (c.type !== "devices" || c.capability !== presentedProof)
      fail("恢复凭据不匹配。", 403);
    if (path.endsWith("status")) {
      c.ready = true;
      secretCommands.set("revoked:" + sessionDevices[1].sessionId, {});
      return ok({
        commandId: id,
        currentDevice: "READY",
        propagation: "PENDING",
      });
    }
    return ok(
      c.ready
        ? outcome(id)
        : {
            ...outcome(id),
            status: "COMMITTED",
            tokenName: null,
            tokenValue: null,
          },
    );
  }
  if (path === "/user/mobile/commands")
    return ok(
      once(path, b.commandId, b, () => {
        if (!/^1[3-9]\d{9}$/.test(b.mobile)) fail("手机号格式不正确。");
        secretCommands.set(b.commandId, {
          type: "mobile",
          mobile: b.mobile,
          expiresAt: later(),
          codes: {},
          committed: false,
        });
        return {
          commandId: b.commandId,
          expiresAt: later(),
          oldProofRequired: true,
        };
      }),
    );
  if (
    /^\/user\/mobile\/commands\/[^/]+(\/(codes|commit|recovery-status|resume))?$/.test(
      path,
    )
  ) {
    const id = path.split("/")[4],
      c = requireRow(secretCommands.get(id));
    if (c.type !== "mobile") fail("命令类型不正确。", 403);
    if (Date.parse(c.expiresAt) <= Date.now()) fail("换绑验证已过期。", 410);
    if (path.endsWith("/codes")) {
      const previous = c.codes[b.type];
      if (previous && Date.now() - previous.sent < 60_000)
        return ok({
          challengeId: previous.id,
          expiresAt: c.expiresAt,
          attempted: false,
        });
      const challenge = { id: crypto.randomUUID(), sent: Date.now() };
      c.codes[b.type] = challenge;
      return ok({
        challengeId: challenge.id,
        expiresAt: c.expiresAt,
        attempted: true,
      });
    }
    if (path.endsWith("/commit")) {
      if (
        !c.codes.NEW_PHONE ||
        b.newCode !== "123456" ||
        !(b.password || (c.codes.OLD_PHONE && b.oldCode === "123456"))
      )
        fail("验证码或原账号验证不正确。");
      if (c.committed && c.capability !== presentedProof)
        fail("命令恢复凭据不匹配。", 409);
      c.committed = true;
      c.capability = presentedProof;
      c.hashed = !!proofHash;
      s.user.phone = c.mobile;
      return ok({
        commandId: id,
        credentialPropagation: "PENDING",
        currentDevice: "PENDING",
        replacement: {
          ...outcome(id),
          status: "COMMITTED",
          tokenName: null,
          tokenValue: null,
        },
      });
    }
    if (path.endsWith("recovery-status") || path.endsWith("resume")) {
      if (!c.committed || c.capability !== o.headers?.["X-Recovery-Capability"])
        fail("恢复凭据不匹配。", 403);
      if (path.endsWith("resume")) return ok(outcome(id));
      return ok({
        commandId: id,
        credentialPropagation: "APPLIED",
        currentDevice: "READY",
        replacement: null,
      });
    }
    return ok({ commandId: id, status: c.committed ? "APPLIED" : "PENDING" });
  }
  if (path === "/user/cancellation")
    return ok(
      once(path, b.requestId, b, () => {
        if (!b.recoveryCapability) fail("缺少恢复凭据。");
        secretCommands.set(b.requestId, {
          type: "cancellation",
          capability: presentedProof,
          hashed: !!proofHash,
          subjectId,
          phase: "PENDING",
          deadline: later(7 * 86_400_000),
        });
        return {
          requestId: b.requestId,
          phase: "PENDING",
          deadline: later(7 * 86_400_000),
          complete: false,
        };
      }),
    );
  if (path.startsWith("/user/cancellation/recover/")) {
    const c = requireRow(secretCommands.get(b.requestId));
    if (
      c.type !== "cancellation" ||
      presentedProof !== c.capability ||
      (b.subjectId && b.subjectId !== c.subjectId)
    )
      fail("注销恢复凭据不匹配。", 403);
    if (path.endsWith("challenge")) {
      c.challenge = crypto.randomUUID();
      return ok({ challengeId: c.challenge, expiresAt: later() });
    }
    if (path.endsWith("verify") && (!c.challenge || b.code !== "123456"))
      fail("恢复验证码不正确。");
    if (path.endsWith("password") && !b.password) fail("请输入密码。");
    c.operationId = b.operationId;
    return ok({
      subjectId,
      requestId: b.requestId,
      operationId: b.operationId,
      bindingVersion: 1,
      proofDigest: "demo-proof-only",
      expiresAt: later(),
    });
  }
  if (/^\/user\/cancellation\/[^/]+\/[^/]+\/(status|cancel)$/.test(path)) {
    const [, , , subject, id] = path.split("/"),
      c = requireRow(secretCommands.get(id));
    if (c.subjectId !== subject || c.capability !== presentedProof)
      fail("注销恢复凭据不匹配。", 403);
    if (path.endsWith("cancel")) {
      if (!c.operationId || c.operationId !== b.credentialOperation)
        fail("请先验证原账号身份。", 403);
      if (Date.parse(c.deadline) <= Date.now())
        fail("注销已完成，无法撤销。", 409);
      c.phase = "ACTIVE";
    }
    return ok({
      requestId: id,
      phase: c.phase,
      deadline: c.deadline,
      complete: c.phase === "FINALIZED",
    });
  }
  if (path === "/auth/consent/offer-with-password") {
    if (!b.userName || !b.password) fail("请填写账号和密码。");
    return { code: 20005, data: { consentProof: crypto.randomUUID() } };
  }
  return undefined;
}

export function snapshotV4Recovery(s: Context) {
  if (!s.v4) return;
  s.v4.recoveries = Object.fromEntries(
    [...secretCommands]
      .filter(
        ([, row]) =>
          row.hashed &&
          ["devices", "mobile", "cancellation"].includes(row.type),
      )
      .map(([key, row]) => {
        const { capability, hashed, ...value } = row;
        return [key, { ...structuredClone(value), capabilityHash: capability }];
      }),
  );
}
