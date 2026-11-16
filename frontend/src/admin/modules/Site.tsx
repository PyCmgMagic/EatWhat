import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminState } from "../../app/admin-state";
import { useApp } from "../../app/state";
import type { Schema } from "../../api/models";
import type { AiSettings, AiTestResult } from "../../api/v4";
import { useCommand } from "../../features/v4/shared";
import {
  Async,
  Confirm,
  Drawer,
  Field,
  Icon,
  Meta,
  Notice,
  Pager,
  Panel,
  Pill,
  Segmented,
  Toggle,
  dateTime,
  fromLocalInput,
  toLocalInput,
  type Tone,
} from "../kit";

/* ================= 公告 ================= */
type Announcement = Schema["AdminAnnouncementResponse"];
const platforms = ["web", "android", "ios"];
function announcementState(a: Announcement): [Tone, string] {
  const now = Date.now();
  if (!a.enabled) return ["neutral", "已停用"];
  if (a.startsAt && Date.parse(a.startsAt) > now) return ["info", "未开始"];
  if (a.endsAt && Date.parse(a.endsAt) <= now) return ["neutral", "已结束"];
  return ["good", "生效中"];
}

export function Announcements() {
  const { api } = useApp(),
    [page, setPage] = useAdminState("announcements.page", 1),
    [edit, setEdit] = useState<Announcement | true | null>(null),
    [remove, setRemove] = useState<Announcement | null>(null),
    task = useCommand();
  const q = useQuery({
    queryKey: ["admin", "announcements", page],
    queryFn: () => api.adminAnnouncements({ page, pageSize: 12 }),
  });
  return (
    <>
      <div className="ew-admin-toolbar">
        <span className="ew-admin-toolbar-note">
          公告按平台、校区、版本和时间筛选后展示给用户。
        </span>
        <button className="ew-admin-btn is-primary" onClick={() => setEdit(true)}>
          <Icon name="add" size={16} />
          新建公告
        </button>
      </div>
      <Panel flush>
        <Async
          query={q}
          rows={5}
          empty={!q.data?.items?.length}
          emptyTitle="还没有公告"
          emptyHint="新建一条公告，向用户说明活动、维护或版本变化。"
        >
          <ul className="ew-admin-notices">
            {q.data?.items?.map((item) => {
              const [tone, label] = announcementState(item);
              return (
                <li key={item.id}>
                  <div>
                    <h3>
                      {item.title || "未命名公告"}
                      {item.level === "IMPORTANT" && (
                        <Pill tone="bad" dot={false}>
                          重要
                        </Pill>
                      )}
                      <Pill tone={tone}>{label}</Pill>
                    </h3>
                    <p>{item.content}</p>
                    <small>
                      {item.platforms?.length
                        ? item.platforms.join(" / ")
                        : "全部平台"}
                      {" · "}
                      {item.campusIds?.length
                        ? `${item.campusIds.length} 个校区`
                        : "全部校区"}
                      {" · "}
                      {item.startsAt || item.endsAt
                        ? `${item.startsAt ? dateTime(item.startsAt) : "即时"} 至 ${item.endsAt ? dateTime(item.endsAt) : "长期"}`
                        : "长期有效"}
                      {" · 更新于 "}
                      {dateTime(item.updatedAt)}
                    </small>
                  </div>
                  <div className="ew-admin-row-actions">
                    <button
                      className="ew-admin-icon-btn"
                      aria-label={`编辑 ${item.title ?? "公告"}`}
                      title="编辑"
                      onClick={() => setEdit(item)}
                    >
                      <Icon name="edit" size={17} />
                    </button>
                    <button
                      className="ew-admin-icon-btn is-danger"
                      aria-label={`删除 ${item.title ?? "公告"}`}
                      title="删除"
                      onClick={() => setRemove(item)}
                    >
                      <Icon name="delete" size={17} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Async>
        <Pager
          page={page}
          total={q.data?.totalItems}
          totalPages={q.data?.totalPages}
          hasNext={q.data?.hasNext}
          onChange={setPage}
        />
      </Panel>
      {edit && (
        <AnnouncementEditor
          value={edit === true ? undefined : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            void q.refetch();
          }}
        />
      )}
      {remove && (
        <Confirm
          danger
          title={`删除公告「${remove.title || "未命名公告"}」？`}
          confirmLabel="删除公告"
          busy={task.busy}
          onClose={() => setRemove(null)}
          onConfirm={() =>
            void task.run(
              () =>
                api.deleteAnnouncement(remove.id!, {
                  expectedRevision: remove.revision!,
                }),
              async () => {
                setRemove(null);
                task.say("公告已删除。");
                await q.refetch();
              },
            )
          }
        >
          删除后用户端不再显示。只想暂时下线可以改为停用。
        </Confirm>
      )}
    </>
  );
}

function AnnouncementEditor({
  value,
  onClose,
  onSaved,
}: {
  value?: Announcement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useApp(),
    campuses = useQuery({
      queryKey: ["campuses"],
      queryFn: () => api.campuses(),
      staleTime: 300000,
    }),
    [level, setLevel] = useState<"NORMAL" | "IMPORTANT">(
      value?.level ?? "NORMAL",
    ),
    [enabled, setEnabled] = useState(value?.enabled ?? true),
    [chosenPlatforms, setPlatforms] = useState(value?.platforms ?? []),
    [campusIds, setCampusIds] = useState(value?.campusIds ?? []),
    task = useCommand();
  const flip = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  return (
    <Drawer
      wide
      title={value ? "编辑公告" : "新建公告"}
      subtitle={value ? `#${value.id} · 修订 ${value.revision}` : undefined}
      onClose={onClose}
      onSubmit={(e) => {
        const d = new FormData(e.currentTarget),
          text = (name: string) => String(d.get(name) ?? "").trim(),
          build = (name: string) =>
            text(name) === "" ? undefined : Number(text(name));
        void task.run(
          () => {
            const startsAt = fromLocalInput(text("startsAt")),
              endsAt = fromLocalInput(text("endsAt"));
            if (startsAt && endsAt && endsAt <= startsAt)
              throw new Error("结束时间需要晚于开始时间。");
            const body: Schema["RemoteConfigSaveAnnouncementRequest"] = {
              level,
              title: text("title") || undefined,
              content: text("content"),
              linkUrl: text("linkUrl") || undefined,
              enabled,
              platforms: chosenPlatforms,
              campusIds,
              minBuild: build("minBuild"),
              maxBuild: build("maxBuild"),
              startsAt,
              endsAt,
              expectedRevision: value?.revision ?? undefined,
            };
            return value
              ? api.editAnnouncement(value.id!, body)
              : api.createAnnouncement(body);
          },
          async () => {
            task.say("公告已保存。");
            onSaved();
          },
        );
      }}
      footer={
        <>
          <label className="ew-admin-switch-row">
            <Toggle checked={enabled} onChange={setEnabled} label="启用公告" />
            {enabled ? "保存后启用" : "保存为停用"}
          </label>
          <button type="button" className="ew-admin-btn" onClick={onClose}>
            取消
          </button>
          <button
            className="ew-admin-btn is-primary"
            disabled={task.busy || task.uncertain}
          >
            {task.busy ? "保存中…" : "保存公告"}
          </button>
        </>
      }
    >
      <div className="ew-admin-form">
        <Field label="标题" wide>
          <input name="title" defaultValue={value?.title ?? ""} />
        </Field>
        <Field label="正文" wide>
          <textarea
            name="content"
            rows={5}
            defaultValue={value?.content ?? ""}
            required
          />
        </Field>
        <Field label="关联链接" hint="选填，点击公告后打开" wide>
          <input
            name="linkUrl"
            type="url"
            placeholder="https://"
            defaultValue={value?.linkUrl ?? ""}
          />
        </Field>
        <div className="ew-admin-field" data-wide>
          <span>级别</span>
          <Segmented
            label="公告级别"
            value={level}
            onChange={setLevel}
            options={[
              ["NORMAL", "普通"],
              ["IMPORTANT", "重要"],
            ]}
          />
        </div>
      </div>
      <h3 className="ew-admin-subhead">发布范围</h3>
      <div className="ew-admin-form">
        <div className="ew-admin-field" data-wide>
          <span>平台</span>
          <div className="ew-admin-checks">
            {platforms.map((p) => (
              <label key={p}>
                <input
                  type="checkbox"
                  checked={chosenPlatforms.includes(p)}
                  onChange={() => setPlatforms((v) => flip(v, p))}
                />
                {p}
              </label>
            ))}
          </div>
          <small>不选表示全部平台</small>
        </div>
        <div className="ew-admin-field" data-wide>
          <span>校区</span>
          <div className="ew-admin-checks">
            {campuses.data?.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={campusIds.includes(c.id!)}
                  onChange={() => setCampusIds((v) => flip(v, c.id!))}
                />
                {c.name}
              </label>
            ))}
            {campuses.isError && <em>校区列表加载失败</em>}
          </div>
          <small>不选表示全部校区</small>
        </div>
        <Field label="最低构建号" hint="留空不限">
          <input
            name="minBuild"
            type="number"
            min="0"
            step="1"
            defaultValue={value?.minBuild || ""}
          />
        </Field>
        <Field label="最高构建号" hint="留空不限">
          <input
            name="maxBuild"
            type="number"
            min="0"
            step="1"
            defaultValue={value?.maxBuild || ""}
          />
        </Field>
        <Field label="开始时间" hint="留空立即生效">
          <input
            name="startsAt"
            type="datetime-local"
            defaultValue={toLocalInput(value?.startsAt)}
          />
        </Field>
        <Field label="结束时间" hint="留空长期有效">
          <input
            name="endsAt"
            type="datetime-local"
            defaultValue={toLocalInput(value?.endsAt)}
          />
        </Field>
      </div>
    </Drawer>
  );
}

/* ================= 远程配置与版本 ================= */
const flagNames: Record<string, [string, string]> = {
  publish: ["菜品发布", "关闭后用户无法发布新菜品"],
  newShop: ["新建店铺", "关闭后用户无法新建餐厅"],
  comment: ["评论", "关闭后用户无法发表评论"],
  push: ["推送", "关闭后不再发送推送通知"],
  topic: ["专题", "关闭后隐藏校园专题入口"],
};
function useRemoteConfig() {
  const cache = useQueryClient(),
    { api } = useApp(),
    q = useQuery({
      queryKey: ["admin", "remote-config"],
      queryFn: () => api.adminRemoteConfig(),
    });
  return {
    q,
    refresh: async () => {
      await q.refetch();
      await cache.invalidateQueries({ queryKey: ["remote-config"] });
    },
  };
}
function ConfigHeader({ q }: { q: ReturnType<typeof useRemoteConfig>["q"] }) {
  return (
    <div className="ew-admin-toolbar">
      <span className="ew-admin-toolbar-note">
        站点 {q.data?.siteMode ?? "—"} · 配置版本 {q.data?.configVersion ?? "—"}
      </span>
      <button
        className="ew-admin-btn"
        disabled={q.isFetching}
        onClick={() => void q.refetch()}
      >
        <Icon name="shuffle" size={16} />
        {q.isFetching ? "读取中…" : "重新读取"}
      </button>
    </div>
  );
}

export function Config() {
  const { q, refresh } = useRemoteConfig();
  return (
    <>
      <ConfigHeader q={q} />
      <Async query={q} rows={6}>
        {q.data?.settings && (
          <SettingsEditor
            key={q.data.settings.revision}
            value={q.data.settings}
            refresh={refresh}
          />
        )}
      </Async>
    </>
  );
}

function SettingsEditor({
  value,
  refresh,
}: {
  value: Schema["SettingsResponse"];
  refresh: () => Promise<unknown>;
}) {
  const { api } = useApp(),
    [flags, setFlags] = useState(() =>
      Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(flagNames),
            ...Object.keys(value.flags ?? {}),
          ]),
        ].map((key) => [
          key,
          {
            on: value.flags?.[key]?.on ?? true,
            reason: value.flags?.[key]?.reason ?? "",
          },
        ]),
      ),
    ),
    [params, setParams] = useState(JSON.stringify(value.params ?? {}, null, 2)),
    [mode, setMode] = useState<"NONE" | "READ_ONLY" | "DOWN">(
      value.maintenance?.mode ?? "NONE",
    ),
    [message, setMessage] = useState(value.maintenance?.message ?? ""),
    [until, setUntil] = useState(toLocalInput(value.maintenance?.until)),
    task = useCommand();
  return (
    <form
      className="ew-admin-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void task.run(
          () => {
            let parsed: unknown;
            try {
              parsed = JSON.parse(params);
            } catch {
              throw new Error("运营参数不是有效的 JSON。");
            }
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
              throw new Error("运营参数需为对象。");
            if (value.revision == null)
              throw new Error("配置修订号缺失，请重新读取。");
            return api.saveRemoteSettings({
              flags,
              params: parsed,
              maintenance: {
                mode,
                message: message || undefined,
                until: fromLocalInput(until),
              },
              expectedRevision: value.revision,
            });
          },
          async () => {
            task.say("配置已保存。");
            await refresh();
          },
        );
      }}
    >
      <Panel title="功能开关" hint="关闭后，用户端会显示填写的说明" flush>
        <ul className="ew-admin-flags">
          {Object.entries(flags).map(([key, flag]) => (
            <li key={key}>
              <div>
                <strong>{flagNames[key]?.[0] ?? key}</strong>
                <small>{flagNames[key]?.[1] ?? `自定义开关 ${key}`}</small>
              </div>
              {!flag.on && (
                <input
                  aria-label={`${flagNames[key]?.[0] ?? key}关闭说明`}
                  placeholder="关闭时向用户显示的说明"
                  value={flag.reason}
                  onChange={(e) =>
                    setFlags({
                      ...flags,
                      [key]: { ...flag, reason: e.target.value },
                    })
                  }
                />
              )}
              <Toggle
                checked={flag.on}
                label={flagNames[key]?.[0] ?? key}
                onChange={(on) =>
                  setFlags({ ...flags, [key]: { ...flag, on } })
                }
              />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="维护模式" hint="只读维护会禁止写入；暂停服务会拦截全部访问">
        <Segmented
          label="维护状态"
          value={mode}
          onChange={setMode}
          options={[
            ["NONE", "正常运行"],
            ["READ_ONLY", "只读维护"],
            ["DOWN", "暂停服务"],
          ]}
        />
        {mode !== "NONE" && (
          <>
            <Notice tone={mode === "DOWN" ? "bad" : "warn"}>
              保存后立即对全站用户生效，请确认已做好通知。
            </Notice>
            <div className="ew-admin-form">
              <Field label="维护说明" wide>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="向用户说明维护原因"
                />
              </Field>
              <Field label="预计恢复时间" hint="选填">
                <input
                  type="datetime-local"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}
      </Panel>
      <Panel
        title="高级运营参数"
        hint="JSON 对象：饭点窗口、推荐批量、评分门槛、轮询、距离与分类顺序等。保留未修改的已有键。"
      >
        <textarea
          className="is-mono ew-admin-code"
          aria-label="运营参数"
          value={params}
          onChange={(e) => setParams(e.target.value)}
          rows={12}
          spellCheck={false}
        />
      </Panel>
      <div className="ew-admin-savebar">
        <span>
          修订 {value.revision} · 更新于 {dateTime(value.updatedAt)}
          {value.updatedBy ? ` · 管理员 #${value.updatedBy}` : ""}
        </span>
        <button
          className="ew-admin-btn is-primary"
          disabled={task.busy || task.uncertain}
        >
          {task.busy ? "保存中…" : "保存配置"}
        </button>
      </div>
    </form>
  );
}

export function Versions() {
  const { q, refresh } = useRemoteConfig();
  return (
    <>
      <ConfigHeader q={q} />
      <Async
        query={q}
        rows={6}
        empty={!q.data?.versions?.length}
        emptyTitle="暂无版本线"
      >
        <div className="ew-admin-cards">
          {q.data?.versions?.map((line) => (
            <VersionEditor
              key={`${line.platform}:${line.revision}`}
              value={line}
              refresh={refresh}
            />
          ))}
        </div>
      </Async>
    </>
  );
}
function VersionEditor({
  value,
  refresh,
}: {
  value: Schema["AdminVersionLineResponse"];
  refresh: () => Promise<unknown>;
}) {
  const { api } = useApp(),
    [min, setMin] = useState(value.minBuild ?? 0),
    task = useCommand();
  return (
    <Panel
      title={
        <>
          <Icon name={value.platform === "web" ? "earth" : "phone"} size={18} />
          {value.platform}
        </>
      }
      hint={`修订 ${value.revision} · 更新于 ${dateTime(value.updatedAt)}`}
      actions={
        <Pill tone="accent" dot={false}>
          {value.latestVersionName || `build ${value.latestBuild}`}
        </Pill>
      }
    >
      <form
        className="ew-admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget),
            text = (name: string) => String(d.get(name) ?? "").trim();
          void task.run(
            () => {
              if (value.revision == null || !value.platform)
                throw new Error("版本修订信息缺失，请重新读取。");
              return api.saveVersionLine(value.platform, {
                minBuild: min,
                latestBuild: Number(text("latest")),
                latestVersionName: text("name") || undefined,
                storeUrl: text("url") || undefined,
                releaseNotes: text("notes") || undefined,
                expectedRevision: value.revision,
              });
            },
            async () => {
              task.say(`${value.platform} 版本线已保存。`);
              await refresh();
            },
          );
        }}
      >
        <Field label="最低可用构建号" hint="低于此版本会被强制更新">
          <input
            type="number"
            min={0}
            step={1}
            value={min}
            onChange={(e) => setMin(Number(e.target.value))}
          />
        </Field>
        <Field label="最新构建号">
          <input
            name="latest"
            type="number"
            min={min}
            step={1}
            defaultValue={value.latestBuild ?? 0}
          />
        </Field>
        <Field label="版本名称">
          <input name="name" defaultValue={value.latestVersionName ?? ""} />
        </Field>
        <Field label="更新地址">
          <input
            name="url"
            type="url"
            placeholder="https://"
            defaultValue={value.storeUrl ?? ""}
          />
        </Field>
        <Field label="更新说明" wide>
          <textarea
            name="notes"
            rows={3}
            defaultValue={value.releaseNotes ?? ""}
          />
        </Field>
        <div className="ew-admin-form-actions">
          <button className="ew-admin-btn" disabled={task.busy || task.uncertain}>
            {task.busy ? "保存中…" : "保存版本线"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

/* ================= AI ================= */
export function Ai() {
  const { api } = useApp(),
    q = useQuery({
      queryKey: ["admin", "ai-settings"],
      queryFn: () => api.adminAiSettings(),
    });
  return (
    <Async query={q} rows={6}>
      {q.data && (
        <div className="ew-admin-cards is-uneven">
          <AiSettingsEditor
            key={q.data.updatedAt ?? 0}
            value={q.data}
            refresh={() => q.refetch()}
          />
          <AiTest />
        </div>
      )}
    </Async>
  );
}
function AiSettingsEditor({
  value,
  refresh,
}: {
  value: AiSettings;
  refresh: () => Promise<unknown>;
}) {
  const { api } = useApp(),
    [enabled, setEnabled] = useState(value.enabled === true),
    [imageCheck, setImageCheck] = useState(value.imageCheck !== false),
    task = useCommand();
  return (
    <Panel
      title="模型提供商"
      hint={
        value.configured
          ? `${value.apiKeyHint ? `API Key 尾号 ${value.apiKeyHint} · ` : ""}更新于 ${dateTime(value.updatedAt)}`
          : "尚未配置。保存后，发布菜品时可以用 AI 建议分类和口味。"
      }
      actions={
        <Pill
          tone={!value.configured ? "neutral" : value.enabled ? "good" : "warn"}
        >
          {!value.configured ? "未配置" : value.enabled ? "已启用" : "已停用"}
        </Pill>
      }
    >
      <form
        className="ew-admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            d = new FormData(form),
            text = (name: string) => String(d.get(name) ?? "").trim();
          void task.run(
            () => {
              if (!/^https:\/\//i.test(text("baseUrl")))
                throw new Error("接口地址需为公网 https 地址。");
              if (!value.configured && !text("apiKey"))
                throw new Error("首次配置需要填写 API Key。");
              if (!text("model")) throw new Error("请填写模型名称。");
              return api.saveAdminAiSettings({
                enabled,
                baseUrl: text("baseUrl"),
                apiKey: text("apiKey") || undefined,
                model: text("model"),
                responseFormat: text("format"),
                imageCheck,
              });
            },
            async () => {
              task.say("AI 配置已保存。");
              await refresh();
            },
          );
        }}
      >
        <Field label="接口地址" hint="OpenAI 兼容端点" wide>
          <input
            name="baseUrl"
            inputMode="url"
            placeholder="https://api.openai.com/v1"
            defaultValue={value.baseUrl ?? ""}
          />
        </Field>
        <Field
          label="API Key"
          hint={value.configured ? "留空沿用已保存的 Key" : "首次配置必填"}
          wide
        >
          <input
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={value.apiKeyHint ? `••••${value.apiKeyHint}` : ""}
          />
        </Field>
        <Field label="模型" hint="需要支持图片输入">
          <input name="model" defaultValue={value.model ?? ""} />
        </Field>
        <Field label="返回格式" hint="不支持 json_schema 时改用 json_object">
          <select
            name="format"
            defaultValue={value.responseFormat || "json_schema"}
          >
            <option value="json_schema">json_schema（推荐）</option>
            <option value="json_object">json_object</option>
          </select>
        </Field>
        <label className="ew-admin-switch-row" data-wide>
          <Toggle
            checked={enabled}
            onChange={setEnabled}
            label="启用 AI 建议"
          />
          <span>
            启用 AI 建议
            <small>发布菜品时建议分类与口味</small>
          </span>
        </label>
        <label className="ew-admin-switch-row" data-wide>
          <Toggle
            checked={imageCheck}
            onChange={setImageCheck}
            label="图片检查"
          />
          <span>
            用模型检查公开照片
            <small>识别联系方式和广告；二维码始终在本地识别</small>
          </span>
        </label>
        <div className="ew-admin-form-actions">
          <button
            className="ew-admin-btn is-primary"
            disabled={task.busy || task.uncertain}
          >
            {task.busy ? "保存中…" : "保存配置"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
function AiTest() {
  const { api } = useApp(),
    [result, setResult] = useState<AiTestResult | null>(null),
    task = useCommand(true);
  return (
    <Panel title="连通测试" hint="用一道示例菜验证当前已保存的配置">
      <form
        className="ew-admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          const url = String(
            new FormData(e.currentTarget).get("imageUrl") ?? "",
          ).trim();
          setResult(null);
          void task.run(
            () => api.testAdminAi(url || undefined),
            async (value) => setResult(value),
          );
        }}
      >
        <Field
          label="示例图片地址"
          hint="选填。填一张可公开访问的菜品图，确认模型能识别图片。"
          wide
        >
          <input name="imageUrl" inputMode="url" placeholder="https://" />
        </Field>
        <div className="ew-admin-form-actions">
          <button className="ew-admin-btn" disabled={task.busy}>
            {task.busy ? "测试中…" : "开始测试"}
          </button>
        </div>
      </form>
      {result && (
        <Notice tone={result.ok ? "good" : "bad"}>
          {result.ok
            ? `测试通过：分类「${result.category ?? "—"}」${result.tags?.length ? `，口味 ${result.tags.join("、")}` : ""}`
            : `测试未通过：${result.failure ?? "模型没有返回可用结果。"}`}
        </Notice>
      )}
    </Panel>
  );
}

/* ================= 审计 ================= */
export function Audit() {
  const { api } = useApp(),
    [page, setPage] = useAdminState("config-audit.page", 1),
    [open, setOpen] = useState<Schema["AuditEntryResponse"] | null>(null),
    q = useQuery({
      queryKey: ["admin", "config-audit", page],
      queryFn: () => api.configAudit({ page, pageSize: 20 }),
    });
  return (
    <>
      <Panel flush>
        <Async
          query={q}
          rows={8}
          empty={!q.data?.items?.length}
          emptyTitle="还没有配置修改记录"
        >
          <div className="ew-admin-table-wrap">
            <table className="ew-admin-table is-clickable">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>对象</th>
                  <th>操作</th>
                  <th>修订</th>
                  <th className="is-num">配置版本</th>
                  <th>操作人</th>
                  <th aria-label="详情" />
                </tr>
              </thead>
              <tbody>
                {q.data?.items?.map((item) => (
                  <tr key={item.id} onClick={() => setOpen(item)}>
                    <td className="is-muted">{dateTime(item.occurredAt)}</td>
                    <td>
                      <strong>{item.target}</strong>
                      <small className="ew-admin-sub">{item.targetKey}</small>
                    </td>
                    <td>
                      <Pill
                        dot={false}
                        tone={
                          /delete/i.test(item.action ?? "")
                            ? "bad"
                            : /create/i.test(item.action ?? "")
                              ? "good"
                              : "info"
                        }
                      >
                        {item.action}
                      </Pill>
                    </td>
                    <td className="is-mono">
                      {item.revisionBefore ?? "初始"} → {item.revisionAfter}
                    </td>
                    <td className="is-num">{item.configVersion}</td>
                    <td>管理员 #{item.adminId}</td>
                    <td>
                      <div className="ew-admin-row-actions">
                        <button
                          className="ew-admin-icon-btn"
                          aria-label="查看变更内容"
                          title="查看变更"
                        >
                          <Icon name="eye" size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Async>
        <Pager
          page={page}
          total={q.data?.totalItems}
          totalPages={q.data?.totalPages}
          hasNext={q.data?.hasNext}
          onChange={setPage}
        />
      </Panel>
      {open && (
        <Drawer
          wide
          title={`${open.target} · ${open.action}`}
          subtitle={`${open.targetKey} · ${dateTime(open.occurredAt)}`}
          onClose={() => setOpen(null)}
        >
          <Meta
            items={[
              ["操作人", `管理员 #${open.adminId}`],
              ["配置版本", open.configVersion],
              [
                "修订",
                `${open.revisionBefore ?? "初始"} → ${open.revisionAfter}`,
              ],
              ["记录编号", `#${open.id}`],
            ]}
          />
          <h3 className="ew-admin-subhead">修改前</h3>
          <pre className="ew-admin-code">
            {open.before
              ? JSON.stringify(open.before, null, 2)
              : "（无，首次创建）"}
          </pre>
          <h3 className="ew-admin-subhead">修改后</h3>
          <pre className="ew-admin-code">{JSON.stringify(open.after, null, 2)}</pre>
        </Drawer>
      )}
    </>
  );
}
