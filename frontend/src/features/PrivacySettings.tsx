import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { Modal } from "../components/ui";
import { useTask } from "../components/useTask";
import { DesignIcon as Icon } from "../mobile/ui";
import { BlockedListDialog } from "./ApiV2";
import "./v4/confirm-dialog.css";
import "./privacy-settings.css";

function PrivacySwitch({
  label,
  detail,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean, control: HTMLInputElement) => void;
}) {
  const detailId = useId();
  return (
    <label className="privacy-settings-row privacy-settings-switch-row">
      <span className="privacy-settings-row-copy">
        <strong>{label}</strong>
        {detail && <span id={detailId}>{detail}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        aria-describedby={detail ? detailId : undefined}
        checked={checked}
        disabled={disabled}
        onChange={({ currentTarget }) =>
          onChange(currentTarget.checked, currentTarget)
        }
      />
    </label>
  );
}

function LoadError({ text, retry }: { text: string; retry: () => void }) {
  return (
    <div className="privacy-settings-load-error" role="alert">
      <span>{text}</span>
      <button type="button" onClick={retry}>
        重新加载
      </button>
    </div>
  );
}

function VisibilityForm({
  following,
  follower,
}: {
  following: boolean;
  follower: boolean;
}) {
  const { api } = useApp();
  const [values, setValues] = useState({ following, follower });
  const save = useTask("隐私设置已保存", undefined, ["user"]);
  const changed =
    values.following !== following || values.follower !== follower;

  return (
    <form
      aria-busy={save.isPending}
      onSubmit={(event) => {
        event.preventDefault();
        if (changed) save.run(() => api.privacy(values));
      }}
    >
      <PrivacySwitch
        label="公开我的关注列表"
        checked={values.following}
        disabled={save.isPending}
        onChange={(next) =>
          setValues((value) => ({ ...value, following: next }))
        }
      />
      <PrivacySwitch
        label="公开我的粉丝列表"
        checked={values.follower}
        disabled={save.isPending}
        onChange={(next) =>
          setValues((value) => ({ ...value, follower: next }))
        }
      />
      <div className="privacy-settings-save">
        <span role="status" data-saved={!changed}>
          <Icon name={changed ? "info" : "check"} size={14} />
          {save.isPending
            ? "正在保存修改"
            : changed
              ? "有未保存的修改"
              : "当前设置已保存"}
        </span>
        <button type="submit" disabled={!changed || save.isPending}>
          {save.isPending ? "正在保存…" : "保存可见性"}
        </button>
      </div>
    </form>
  );
}

function VisibilitySettings() {
  const { api, user } = useApp();
  const query = useQuery({
    queryKey: ["user", user?.id],
    queryFn: () => api.otherUser(user!.id!),
    enabled: !!user?.id,
  });
  const following = query.data?.followingsVisible;
  const follower = query.data?.fansVisible;

  return (
    <section
      className="privacy-settings-card"
      aria-labelledby="privacy-visibility-title"
    >
      <h2 id="privacy-visibility-title" className="privacy-settings-title">
        主页可见性
      </h2>
      {query.isPending ? (
        <ContentSkeleton kind="rows" count={2} />
      ) : query.isError || following == null || follower == null ? (
        <LoadError
          text="暂时无法读取公开范围。"
          retry={() => void query.refetch()}
        />
      ) : (
        <VisibilityForm
          key={`${user?.id}-${following}-${follower}`}
          following={following}
          follower={follower}
        />
      )}
    </section>
  );
}

function RecommendationSettings({
  onOpenBlocked,
}: {
  onOpenBlocked: () => void;
}) {
  const { api } = useApp();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["recommendation-settings"],
    queryFn: () => api.recommendationSettings(),
  });
  const save = useTask("推荐设置已更新");
  const [pending, setPending] = useState<boolean | null>(null);
  const personalized = query.data?.personalized;

  return (
    <section
      className="privacy-settings-card"
      aria-labelledby="privacy-recommendation-title"
    >
      <h2 id="privacy-recommendation-title" className="privacy-settings-title">
        推荐与屏蔽
      </h2>
      {query.isPending ? (
        <ContentSkeleton kind="rows" count={1} />
      ) : query.isError || typeof personalized !== "boolean" ? (
        <LoadError
          text="暂时无法读取推荐设置。"
          retry={() => void query.refetch()}
        />
      ) : (
        <PrivacySwitch
          label="个性化推荐"
          detail="根据你的口味和近期浏览推荐"
          checked={pending ?? personalized}
          disabled={save.isPending}
          onChange={(next) => {
            setPending(next);
            save.run(async () => {
              try {
                const saved = await api.saveRecommendationSettings(next);
                cache.setQueryData(["recommendation-settings"], saved);
                await cache.invalidateQueries({ queryKey: ["foods"] });
              } finally {
                setPending(null);
              }
            });
          }}
        />
      )}
      <button
        type="button"
        className="privacy-settings-row privacy-settings-entry"
        onClick={onOpenBlocked}
      >
        <span className="privacy-settings-entry-icon">
          <Icon name="block" size={17} />
        </span>
        <strong>屏蔽名单</strong>
        <Icon name="chevronRight" size={17} />
      </button>
    </section>
  );
}

function TelemetrySettings() {
  const { api, user, toast } = useApp();
  const cache = useQueryClient();
  const queryKey = ["telemetry", "consent", user?.id];
  const query = useQuery({ queryKey, queryFn: () => api.telemetryConsent() });
  const consent = query.data;
  const consentVersion =
    consent?.policyVersion && consent.revision != null
      ? {
          policyVersion: consent.policyVersion,
          expectedRevision: consent.revision,
        }
      : null;
  const [confirmTrigger, setConfirmTrigger] = useState<HTMLInputElement | null>(
    null,
  );
  const save = useTask();

  function saveConsent(enabled: boolean) {
    if (!consentVersion || enabled === consent?.enabled) {
      setConfirmTrigger(null);
      return;
    }
    save.run(async () => {
      await cache.cancelQueries({ queryKey });
      let saved;
      try {
        saved = enabled
          ? await api.saveTelemetryConsent({ ...consentVersion, enabled: true })
          : await api.disableTelemetry(consentVersion);
      } catch (error) {
        await query.refetch();
        throw error;
      } finally {
        setConfirmTrigger(null);
      }
      cache.setQueryData(queryKey, saved);
      if (enabled && saved.enabled && saved.revision != null) {
        try {
          await api.telemetryEvents({
            consentRevision: saved.revision,
            events: [
              {
                eventId: crypto.randomUUID(),
                properties: { event: "app_open" },
              },
            ],
          });
        } catch {
          toast("使用统计已开启，本次统计事件未能发送。");
          return;
        }
      }
      toast(saved.enabled ? "使用统计已开启" : "使用统计已关闭", {
        tone: "success",
      });
    });
  }

  return (
    <section
      className="privacy-settings-card"
      aria-labelledby="privacy-data-title"
      aria-busy={save.isPending}
    >
      <h2 id="privacy-data-title" className="privacy-settings-title">
        数据授权
      </h2>
      {query.isPending ? (
        <ContentSkeleton kind="rows" count={1} />
      ) : query.isError ||
        !consentVersion ||
        typeof consent?.enabled !== "boolean" ? (
        <LoadError
          text="暂时无法读取使用统计设置。"
          retry={() => void query.refetch()}
        />
      ) : (
        <PrivacySwitch
          label="分享使用统计"
          detail={`仅记录预设操作和安装标识${consent.retentionDays != null ? `，保留 ${consent.retentionDays} 天` : ""}。\n不收集输入的文字或网址。`}
          checked={consent.enabled}
          disabled={save.isPending}
          onChange={(next, control) =>
            next ? saveConsent(true) : setConfirmTrigger(control)
          }
        />
      )}
      {confirmTrigger && (
        <Modal
          title="关闭使用统计？"
          className="v4-confirm-dialog"
          returnFocus={confirmTrigger}
          onClose={() => setConfirmTrigger(null)}
          dismissible={!save.isPending}
        >
          <p>关闭后将删除已收集的使用统计，无法恢复。</p>
          <div className="v4-confirm-actions">
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => setConfirmTrigger(null)}
            >
              取消
            </button>
            <button
              type="button"
              className="is-danger"
              disabled={save.isPending}
              onClick={() => saveConsent(false)}
            >
              {save.isPending ? "正在关闭…" : "关闭并删除统计"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default function PrivacySettings() {
  const [blockedOpen, setBlockedOpen] = useState(false);

  return (
    <>
      <div className="privacy-settings">
        <VisibilitySettings />
        <div className="privacy-settings-side">
          <RecommendationSettings onOpenBlocked={() => setBlockedOpen(true)} />
          <TelemetrySettings />
        </div>
      </div>
      {blockedOpen && (
        <BlockedListDialog onClose={() => setBlockedOpen(false)} />
      )}
    </>
  );
}
