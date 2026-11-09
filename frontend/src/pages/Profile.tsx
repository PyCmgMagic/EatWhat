import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { parseId } from "../api/models";
import { FoodGrid } from "../components/FoodCard";
import {
  Empty,
  ErrorState,
  Gate,
  Icon,
  Intro,
  Loading,
  Pagination,
  Picture,
} from "../components/ui";
import { useTask } from "../components/useTask";
export default function Profile() {
  return (
    <Gate verified={false}>
      <ProfileContent />
    </Gate>
  );
}
function ProfileContent() {
  const { user } = useApp(),
    [tab, setTab] = useState("posts");
  return (
    <>
      <Intro title="我的主页" />
      <section className="profile-cover">
        <span className="profile-cover-flower">✳</span>
        <div className="profile-avatar">
          {user?.avatar ? (
            <Picture src={user.avatar} alt="我的头像" />
          ) : (
            <span>{user?.displayName?.slice(0, 1) || "食"}</span>
          )}
        </div>
        <div className="profile-info">
          <h2>
            {user?.displayName || "校园食友"}
            {user?.verified && (
              <span className="verified-badge">
                <Icon name="shield" />
                校内已认证
              </span>
            )}
          </h2>
          <p>{user?.signature || "还没写下签名，先去吃顿好饭吧。"}</p>
          <Link className="text-link" to="/settings">
            <Icon name="edit" />
            编辑资料与认证
          </Link>
        </div>
        <span className="profile-cover-caption">EAT WELL, LIVE WELL.</span>
      </section>
      <div className="profile-tab-row">
        <button
          className={`feed-tab ${tab === "posts" ? "active" : ""}`}
          onClick={() => setTab("posts")}
        >
          我的分享
        </button>
        <button
          className={`feed-tab ${tab === "history" ? "active" : ""}`}
          onClick={() => setTab("history")}
        >
          浏览足迹
        </button>
        <button
          className={`feed-tab ${tab === "social" ? "active" : ""}`}
          onClick={() => setTab("social")}
        >
          关注与粉丝
        </button>
        <Link to="/settings" className="feed-tab">
          账号设置
        </Link>
      </div>
      {tab === "posts" ? (
        <Gate>
          <MyFoods />
        </Gate>
      ) : tab === "history" ? (
        <Gate>
          <History />
        </Gate>
      ) : (
        <Social />
      )}
    </>
  );
}
function MyFoods() {
  const { api } = useApp(),
    [page, setPage] = useState(1),
    q = useQuery({
      queryKey: ["foods", "mine", page],
      queryFn: () => api.myFoods(page),
    });
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      {q.data.items?.length ? (
        <>
          <FoodGrid foods={q.data.items} />
          <p className="section-caption">
            需要修改或删除已有分享，请联系管理员协助维护。
          </p>
        </>
      ) : (
        <Empty
          title="第一份分享，就从今天开始。"
          action={
            <Link className="btn btn-primary" to="/publish">
              分享这一餐
              <Icon name="plus" />
            </Link>
          }
        >
          你喜欢的一道菜，也许会成为别人的下一餐。
        </Empty>
      )}
      <Pagination
        page={page}
        hasNext={q.data.hasNext}
        totalPages={q.data.totalPages}
        onPage={setPage}
      />
    </>
  );
}
function History() {
  const { api } = useApp(),
    [page, setPage] = useState(1),
    [kind, setKind] = useState<"food" | "restaurant">("food");
  const q = useQuery({
    queryKey: ["history", kind, page],
    queryFn: () => api.history(kind, page),
  });
  return (
    <>
      <div className="chips history-filters">
        {(["food", "restaurant"] as const).map((k) => (
          <button
            key={k}
            className={`chip ${kind === k ? "active" : ""}`}
            onClick={() => {
              setKind(k);
              setPage(1);
            }}
          >
            {k === "food" ? "看过的菜品" : "看过的餐厅"}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : q.data.items?.length ? (
        <div className="history-grid">
          {q.data.items.map((h, i) => {
            const item = kind === "food" ? h.food : h.restaurant;
            return (
              <Link
                className="history-card"
                key={`${h.targetId}-${i}`}
                to={
                  kind === "food"
                    ? `/foods/${h.targetId}`
                    : `/restaurants/${h.targetId}`
                }
              >
                <div>
                  <Picture
                    src={item?.pictureUrl?.[0]}
                    alt={item?.name || "浏览记录"}
                  />
                </div>
                <span>
                  <strong>{item?.name || "内容信息暂不可用"}</strong>
                  <small>
                    {h.viewedAt
                      ? new Date(h.viewedAt).toLocaleString("zh-CN")
                      : "时间待补充"}
                  </small>
                </span>
                <Icon name="arrow" />
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty
          title="还没有留下浏览足迹"
          action={
            <Link to="/" className="btn btn-primary">
              去发现
            </Link>
          }
        >
          看过的美味，将在这里等你再次回味。
        </Empty>
      )}
      <Pagination
        page={page}
        hasNext={q.data?.hasNext}
        totalPages={q.data?.totalPages}
        onPage={setPage}
      />
    </>
  );
}
function Social() {
  const { api } = useApp(),
    [kind, setKind] = useState<"followers" | "followings">("followings"),
    [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["social", kind, page],
    queryFn: () => api.followers(kind, undefined, page),
  });
  return (
    <>
      <div className="chips history-filters">
        <button
          className={`chip ${kind === "followings" ? "active" : ""}`}
          onClick={() => {
            setKind("followings");
            setPage(1);
          }}
        >
          我的关注
        </button>
        <button
          className={`chip ${kind === "followers" ? "active" : ""}`}
          onClick={() => {
            setKind("followers");
            setPage(1);
          }}
        >
          我的粉丝
        </button>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : q.data.items?.length ? (
        <div className="people-list">
          {q.data.items.map((p) => (
            <Link key={p.id} to={`/users/${p.id}`}>
              <span className="avatar">
                {p.displayName?.slice(0, 1) || "食"}
              </span>
              <strong>{p.displayName || "同学"}</strong>
              <Icon name="arrow" />
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="美味的相遇，慢慢来。">
          从一份心动的分享出发，认识更多同好。
        </Empty>
      )}
      <Pagination
        page={page}
        hasNext={q.data?.hasNext}
        totalPages={q.data?.totalPages}
        onPage={setPage}
      />
    </>
  );
}
export function OtherProfile() {
  const id = parseId(useParams().id),
    { user } = useApp();
  return (
    <Gate verified={false}>
      {id ? (
        id === user?.id ? (
          <ProfileContent />
        ) : (
          <OtherContent id={id} />
        )
      ) : (
        <Empty title="同学主页地址无效">请从分享列表重新打开。</Empty>
      )}
    </Gate>
  );
}
function OtherContent({ id }: { id: number }) {
  const { api } = useApp(),
    q = useQuery({ queryKey: ["user", id], queryFn: () => api.otherUser(id) }),
    task = useTask("关注状态已更新", undefined, ["user", "social"]);
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const u = q.data;
  return (
    <>
      <Intro title="同学主页" />
      <div className="public-profile settings-card">
        <span className="avatar public-avatar">
          {u.displayName?.slice(0, 1) || "食"}
        </span>
        <h2>{u.displayName || "校园食友"}</h2>
        <div className="public-stats">
          <span>
            <strong>{u.earnedLikes ?? "—"}</strong>收到喜欢
          </span>
          <span>
            <strong>
              {u.fansVisible === false ? "私密" : (u.fansCount ?? "—")}
            </strong>
            粉丝
          </span>
          <span>
            <strong>
              {u.followingsVisible === false
                ? "私密"
                : (u.followingsCount ?? "—")}
            </strong>
            关注
          </span>
          <span>
            <strong>{u.uploadedFoodsCount ?? "—"}</strong>菜品分享
          </span>
        </div>
        <button
          className="btn btn-primary"
          disabled={task.isPending || u.isFollowingHim == null}
          onClick={() => task.run(() => api.follow(id, u.isFollowingHim!))}
        >
          <Icon name={u.isFollowingHim ? "check" : "plus"} />
          {u.isFollowingHim ? "已关注" : "关注这位同学"}
        </button>
        {task.error && <ErrorState error={task.error} />}
      </div>
    </>
  );
}
