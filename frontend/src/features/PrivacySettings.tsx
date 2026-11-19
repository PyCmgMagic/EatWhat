import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { useTask } from "../components/useTask";
import { DesignIcon as Icon } from "../mobile/ui";
import { BlockedListDialog } from "./ApiV2";
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
  onChange: (value: boolean) => void;
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
        onChange={(event) => onChange(event.target.checked)}
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

export default function PrivacySettings() {
  const [blockedOpen, setBlockedOpen] = useState(false);

  return (
    <>
      <div className="privacy-settings">
        <VisibilitySettings />
        <div className="privacy-settings-side">
          <RecommendationSettings onOpenBlocked={() => setBlockedOpen(true)} />
          <section
            className="privacy-settings-card"
            aria-labelledby="privacy-data-title"
          >
            <h2 id="privacy-data-title" className="privacy-settings-title">
              数据授权
            </h2>
            <Link
              className="privacy-settings-row privacy-settings-entry"
              to="/settings/telemetry"
            >
              <span className="privacy-settings-entry-icon">
                <Icon name="document" size={17} />
              </span>
              <strong>使用统计授权</strong>
              <Icon name="chevronRight" size={17} />
            </Link>
          </section>
        </div>
      </div>
      {blockedOpen && (
        <BlockedListDialog onClose={() => setBlockedOpen(false)} />
      )}
    </>
  );
}
