import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import type { V2Schema } from "../api/backend-v2";
import { useV2 } from "./state";
import { priceLabels, useRestaurantTags } from "./discover";
import { CheckOptions } from "./restaurants";
import {
  Form,
  Notice,
  PageControls,
  Picture,
  QueryState,
  useAction,
  value,
} from "./ui";

export function Profile() {
  const { user } = useV2();
  return (
    <section className="v2-panel">
      <div className="v2-profile">
        <Picture url={user?.avatar} />
        <div>
          <h1>{user?.displayName || "我的"}</h1>
          <p>{user?.signature}</p>
          {user?.verified && <p>已通过学生认证</p>}
        </div>
      </div>
      <nav className="v2-links" aria-label="个人页面">
        <Link to="/me/edit">编辑资料</Link>
        <Link to="/favorites">我的收藏</Link>
        <Link to="/foods/favorites">收藏的菜品</Link>
        <Link to="/foods/my">我的菜品</Link>
        <Link to="/comments/my">我的评论</Link>
        <Link to="/notifications">通知</Link>
        <Link to="/history">浏览历史</Link>
        <Link to="/feedback">意见反馈</Link>
        <Link to="/follows?kind=followings">关注</Link>
        <Link to="/follows?kind=followers">粉丝</Link>
        <Link to="/settings">账号设置</Link>
      </nav>
    </section>
  );
}

export function ProfileEditor() {
  const { user, call, upload, refreshIdentity } = useV2();
  const selected = useRef<File>(null);
  const uploaded = useRef<{ file: File; key: string }>(null);
  return (
    <section className="v2-panel v2-narrow">
      <h1>编辑资料</h1>
      <Form
        success="资料已保存。"
        submit={async (data, signal) => {
          const file = selected.current;
          if (file && uploaded.current?.file !== file)
            uploaded.current = {
              file,
              key: await upload(file, "avatar", signal),
            };
          await call("updateInfo", {
            body: {
              displayName: value(data, "displayName"),
              avatar: file ? uploaded.current?.key : undefined,
              gender: value(data, "gender"),
              birthday: value(data, "birthday"),
              signature: value(data, "signature"),
            },
            signal,
          });
          await refreshIdentity();
        }}
      >
        <Picture url={user?.avatar} className="v2-avatar" />
        <label>
          头像
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => {
              selected.current = event.target.files?.[0] ?? null;
            }}
          />
        </label>
        <label>
          昵称
          <input
            required
            name="displayName"
            defaultValue={user?.displayName}
            maxLength={30}
          />
        </label>
        <label>
          性别
          <select name="gender" defaultValue={user?.gender ?? ""}>
            <option value="">未设置</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          生日
          <input name="birthday" type="date" defaultValue={user?.birthday} />
        </label>
        <label>
          签名
          <textarea
            name="signature"
            defaultValue={user?.signature}
            maxLength={100}
          />
        </label>
      </Form>
    </section>
  );
}

export function Settings() {
  const { signOut, user } = useV2();
  const task = useAction();
  const nav = useNavigate();
  return (
    <section className="v2-panel v2-narrow">
      <h1>账号设置</h1>
      <nav className="v2-links" aria-label="设置选项">
        <Link to="/verify">学生认证</Link>
        <Link to="/settings/phone">
          {user?.phone ? "换绑手机号" : "绑定手机号"}
        </Link>
        <Link to="/settings/password">密码</Link>
        <Link to="/settings/username">登录名</Link>
        <Link to="/settings/devices">登录设备</Link>
        <Link to="/settings/privacy">隐私设置</Link>
        <Link to="/settings/blocked">屏蔽名单</Link>
        <Link to="/settings/preferences">推荐偏好</Link>
        <Link to="/settings/notifications">通知设置</Link>
        <Link to="/data-notice">隐私政策和数据跨境说明</Link>
      </nav>
      <button
        disabled={task.busy}
        onClick={() =>
          void task.run(async () => {
            await signOut();
            nav("/", { replace: true });
          })
        }
      >
        退出登录
      </button>
      <Notice {...task} />
    </section>
  );
}

export function Privacy() {
  const { call, user, refreshIdentity } = useV2();
  return (
    <section className="v2-panel v2-narrow">
      <h1>隐私设置</h1>
      <Form
        success="隐私设置已保存。"
        submit={async (data, signal) => {
          await call("changePrivacy", {
            body: {
              follower: data.has("follower"),
              following: data.has("following"),
            },
            signal,
          });
          await refreshIdentity();
        }}
      >
        <label className="v2-check">
          <input
            type="checkbox"
            name="follower"
            defaultChecked={user?.fansVisible}
          />
          公开粉丝列表
        </label>
        <label className="v2-check">
          <input
            type="checkbox"
            name="following"
            defaultChecked={user?.followingsVisible}
          />
          公开关注列表
        </label>
      </Form>
    </section>
  );
}

export function OtherProfile({ id }: { id: number }) {
  const { user, call } = useV2();
  const task = useAction();
  const query = useQuery({
    queryKey: ["v2", "user", id],
    queryFn: ({ signal }) =>
      call("userInfo", { query: { userId: id }, signal }),
  });
  const person = query.data;
  return (
    <QueryState query={query} empty={!person}>
      {person && (
        <section className="v2-panel">
          <div className="v2-profile">
            <Picture url={person.avatar} />
            <div>
              <h1>{person.displayName}</h1>
              <p>{person.signature}</p>
            </div>
          </div>
          <div className="v2-actions">
            {person.followingsCount != null && (
              <Link to={"/follows?kind=followings&userId=" + id}>
                关注 {person.followingsCount}
              </Link>
            )}
            {person.fansCount != null && (
              <Link to={"/follows?kind=followers&userId=" + id}>
                粉丝 {person.fansCount}
              </Link>
            )}
          </div>
          {user?.id !== id && (
            <div className="v2-actions">
              {!person.blocked && (
                <button
                  disabled={task.busy}
                  onClick={() =>
                    void task.run(async (signal) => {
                      await call(
                        person.isFollowingHim ? "unfollow" : "follow",
                        { query: { userId: id }, signal },
                      );
                      await query.refetch();
                    })
                  }
                >
                  {person.isFollowingHim ? "取消关注" : "关注"}
                </button>
              )}
              <button
                disabled={task.busy}
                onClick={() =>
                  void task.run(async (signal) => {
                    await call(person.blocked ? "unblock" : "block", {
                      path: { userId: id },
                      signal,
                    });
                    await query.refetch();
                  })
                }
              >
                {person.blocked ? "取消屏蔽" : "屏蔽用户"}
              </button>
            </div>
          )}
          <Notice {...task} />
        </section>
      )}
    </QueryState>
  );
}

export function People({
  kind,
  userId,
}: {
  kind: "followers" | "followings" | "blocks";
  userId?: number;
}) {
  const { call } = useV2();
  const [page, setPage] = useState(1);
  const task = useAction();
  const query = useQuery({
    queryKey: ["v2", kind, userId, page],
    queryFn: ({ signal }) =>
      call(kind, { query: { userId, page, pageSize: 20 }, signal }),
  });
  return (
    <section className="v2-panel">
      <h1>
        {kind === "followers"
          ? "粉丝"
          : kind === "followings"
            ? "关注"
            : "屏蔽名单"}
      </h1>
      <QueryState query={query} empty={!query.data?.items?.length}>
        <ul className="v2-list">
          {query.data?.items?.map((person) => {
            const id =
              "userId" in person
                ? person.userId
                : (person as V2Schema["Person"]).id;
            return (
              <li key={id}>
                <Link to={"/users/" + id}>{person.displayName || "食友"}</Link>
                {kind === "blocks" && id && (
                  <button
                    disabled={task.busy}
                    onClick={() =>
                      void task.run(async (signal) => {
                        await call("unblock", { path: { userId: id }, signal });
                        await query.refetch();
                      })
                    }
                  >
                    取消屏蔽
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </QueryState>
      <PageControls
        page={page}
        hasNext={query.data?.hasNext}
        change={setPage}
      />
      <Notice {...task} />
    </section>
  );
}

export function Preferences() {
  const { call } = useV2();
  const cache = useQueryClient();
  const tags = useRestaurantTags();
  const query = useQuery({
    queryKey: ["v2", "preferences"],
    queryFn: ({ signal }) => call("preferences", { signal }),
  });
  const taste = useQuery({
    queryKey: ["v2", "taste"],
    queryFn: ({ signal }) =>
      call("getUserRecommendationProfileTaste", { signal }),
  });
  const task = useAction();
  return (
    <section className="v2-panel v2-narrow">
      <h1>推荐偏好</h1>
      <QueryState query={query}>
        <QueryState query={tags}>
          {query.data && tags.data && (
            <Form
              key={JSON.stringify(query.data)}
              success="偏好已保存。"
              submit={async (data, signal) => {
                const likedTags = data.getAll("likedTags").map(String);
                const dislikedTags = data.getAll("dislikedTags").map(String);
                if (likedTags.some((tag) => dislikedTags.includes(tag)))
                  throw new Error("同一口味不能同时选择喜欢和忌口。");
                await call("savePreferences", {
                  body: {
                    likedTags,
                    dislikedTags,
                    likedCategories: data.getAll("likedCategories").map(String),
                    priceBand: value(data, "priceBand") || undefined,
                    maxDistance:
                      Number(value(data, "maxDistance")) || undefined,
                  },
                  signal,
                });
                cache.removeQueries({ queryKey: ["v2", "recommend"] });
                await query.refetch();
              }}
            >
              <CheckOptions
                name="likedCategories"
                label="喜欢的品类"
                options={tags.data.categories}
                checked={query.data.likedCategories}
              />
              <CheckOptions
                name="likedTags"
                label="喜欢的口味"
                options={tags.data.tags}
                checked={query.data.likedTags}
              />
              <CheckOptions
                name="dislikedTags"
                label="忌口"
                options={tags.data.dislikableTags}
                checked={query.data.dislikedTags}
              />
              <label>
                偏好价位
                <select
                  name="priceBand"
                  defaultValue={query.data.priceBand ?? ""}
                >
                  <option value="">不限</option>
                  {Object.entries(priceLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                堂食最远距离（米）
                <input
                  name="maxDistance"
                  type="number"
                  min={100}
                  max={20000}
                  defaultValue={query.data.maxDistance}
                />
              </label>
            </Form>
          )}
        </QueryState>
      </QueryState>
      <button
        disabled={task.busy}
        onClick={() =>
          void task.run(async (signal) => {
            await call("clearPreferences", { signal });
            cache.removeQueries({ queryKey: ["v2", "recommend"] });
            await query.refetch();
          }, "偏好已清空。")
        }
      >
        清空偏好
      </button>
      <Notice {...task} />
      {!!(
        taste.data?.inferredCategories?.length ||
        taste.data?.inferredTags?.length
      ) && (
        <div className="v2-inferred-taste">
          <h2>最近口味</h2>
          <ul className="v2-tags">
            {[
              ...(taste.data.inferredCategories ?? []),
              ...(taste.data.inferredTags ?? []),
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
