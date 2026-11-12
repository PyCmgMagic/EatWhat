import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import type { V2Schema } from "../api/backend-v2";
import { useV2 } from "./state";
import {
  Notice,
  PageControls,
  Picture,
  QueryState,
  dateTime,
  useAction,
} from "./ui";

type Food = V2Schema["FoodV2"];
type Comment = V2Schema["Comment"];

const money = (price?: number | null) =>
  price == null ? "" : `¥${Number(price).toFixed(Number(price) % 1 ? 2 : 0)}`;

export function RestaurantFoods({
  restaurantId,
  editable,
}: {
  restaurantId: number;
  editable: boolean;
}) {
  const { call } = useV2();
  const foods = useQuery({
    queryKey: ["v2", "foods", "restaurant", restaurantId],
    queryFn: ({ signal }) =>
      call("getFoodsList", {
        query: { restaurantId, page: 1, pageSize: 30 },
        signal,
      }),
  });
  return (
    <section className="v2-panel">
      <div className="v2-heading">
        <h2>菜单</h2>
        {editable && (
          <Link to={`/foods/new?restaurantId=${restaurantId}`}>添加菜品</Link>
        )}
      </div>
      <QueryState query={foods} empty={!foods.data?.items?.length}>
        <FoodGrid foods={foods.data?.items} />
      </QueryState>
    </section>
  );
}

export function FoodCollection({ mode }: { mode: "favorites" | "mine" }) {
  const { call } = useV2();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["v2", "foods", mode, page],
    queryFn: ({ signal }) =>
      call(mode === "favorites" ? "getFoodsFavorites" : "getFoodsMy", {
        query: { page, pageSize: 18 },
        signal,
      }),
  });
  return (
    <section className="v2-panel">
      <h1>{mode === "favorites" ? "收藏的菜品" : "我的菜品"}</h1>
      <QueryState query={query} empty={!query.data?.items?.length}>
        <FoodGrid foods={query.data?.items} />
      </QueryState>
      <PageControls
        page={page}
        hasNext={query.data?.hasNext}
        change={setPage}
      />
    </section>
  );
}

function FoodGrid({ foods }: { foods?: Food[] }) {
  return (
    <ul className="v2-food-grid">
      {foods?.map((food) => (
        <li key={food.id}>
          <Link className="v2-food-card" to={`/foods/${food.id}`}>
            <Picture url={food.pictureUrls?.[0]} />
            <div>
              <span>{food.signature ? "招牌" : food.category}</span>
              <h3>{food.name}</h3>
              <p>
                {money(food.price)}
                {food.restaurantName ? ` · ${food.restaurantName}` : ""}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function FoodDetail({ id }: { id: number }) {
  const { call, session, user } = useV2();
  const cache = useQueryClient();
  const task = useAction();
  const food = useQuery({
    queryKey: ["v2", "food", id],
    queryFn: ({ signal }) =>
      call("getFoodsDetailById", { path: { id }, signal }),
  });
  const refresh = async () => {
    await Promise.all([
      food.refetch(),
      cache.invalidateQueries({ queryKey: ["v2", "foods"] }),
      cache.invalidateQueries({ queryKey: ["v2", "recommend"] }),
    ]);
  };
  const data = food.data;
  const editable = user?.verified || user?.role === "admin";
  return (
    <QueryState query={food} empty={!data}>
      {data && (
        <>
          <section className="v2-panel v2-food-detail">
            <div className="v2-food-gallery">
              {(data.pictureUrls?.length ? data.pictureUrls : [null]).map(
                (url, index) => (
                  <Picture key={`${url}:${index}`} url={url} />
                ),
              )}
            </div>
            <div>
              <p className="v2-food-kicker">
                {data.signature ? "招牌菜" : data.category}
              </p>
              <h1>{data.name}</h1>
              <p>{data.restaurantName}</p>
              {data.description && <p>{data.description}</p>}
              <strong>{money(data.price)}</strong>
              <ul className="v2-tags">
                {data.tags?.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
              <div className="v2-actions">
                <Link to={`/restaurants/${data.restaurantId}`}>查看店铺</Link>
                {editable && <Link to={`/foods/${id}/edit`}>编辑菜品</Link>}
                {!session ? (
                  <Link to={`/auth?next=/foods/${id}`}>登录后互动</Link>
                ) : (
                  <>
                    <button
                      disabled={task.busy}
                      aria-pressed={data.isLiked === true}
                      onClick={() =>
                        void task.run(async (signal) => {
                          await call(
                            data.isLiked
                              ? "postFoodsByIdUnlike"
                              : "postFoodsByIdLike",
                            { path: { id }, signal },
                          );
                          await refresh();
                        })
                      }
                    >
                      {data.isLiked
                        ? "取消点赞"
                        : `点赞 ${data.likeCount ?? 0}`}
                    </button>
                    <button
                      disabled={task.busy}
                      aria-pressed={data.isFavorite === true}
                      onClick={() =>
                        void task.run(async (signal) => {
                          await call(
                            data.isFavorite
                              ? "postFoodsByIdUnfavorite"
                              : "postFoodsByIdFavorite",
                            { path: { id }, signal },
                          );
                          await refresh();
                        })
                      }
                    >
                      {data.isFavorite ? "取消收藏" : "收藏菜品"}
                    </button>
                  </>
                )}
              </div>
              <Notice {...task} />
            </div>
          </section>
          <FoodComments foodId={id} canPost={!!editable} />
          <FoodGallery foodId={id} />
          <FoodHistory foodId={id} editable={!!editable} refresh={refresh} />
        </>
      )}
    </QueryState>
  );
}

export function FoodEditor({
  id,
  restaurantId,
}: {
  id?: number;
  restaurantId?: number;
}) {
  const { call } = useV2();
  const existing = useQuery({
    queryKey: ["v2", "food", id],
    enabled: !!id,
    queryFn: ({ signal }) =>
      call("getFoodsDetailById", { path: { id: id! }, signal }),
  });
  const options = useQuery({
    queryKey: ["v2", "food-options"],
    queryFn: ({ signal }) => call("getFoodsOptions", { signal }),
  });
  if (id && (existing.isPending || existing.error || !existing.data))
    return (
      <QueryState query={existing} empty={!existing.data}>
        <span />
      </QueryState>
    );
  return (
    <FoodForm
      key={id ?? "new"}
      food={existing.data}
      restaurantId={restaurantId}
      options={options.data}
    />
  );
}

function FoodForm({
  food,
  restaurantId,
  options,
}: {
  food?: Food;
  restaurantId?: number;
  options?: V2Schema["FoodOptions"];
}) {
  const { call, upload } = useV2();
  const navigate = useNavigate();
  const files = useRef<File[]>([]);
  const task = useAction();
  const suggest = useAction();
  const [suggestion, setSuggestion] = useState<V2Schema["Suggestion"]>();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void task.run(async (signal) => {
      const data = new FormData(form);
      const pictureKeys = files.current.length
        ? await Promise.all(
            files.current.map((file) => upload(file, "foods", signal)),
          )
        : undefined;
      const priceText = String(data.get("price") ?? "").trim();
      const common = {
        name: String(data.get("name") ?? "").trim(),
        category: String(data.get("category") ?? ""),
        price: priceText ? Number(priceText) : undefined,
        description: String(data.get("description") ?? "").trim(),
        pictures: pictureKeys,
        tags: data.getAll("tags").map(String),
        signature: data.has("signature"),
      };
      const result = food?.id
        ? await call("putFoodsEditById", {
            path: { id: food.id },
            body: common,
            signal,
          })
        : await call("postFoodsUpload", {
            body: {
              ...common,
              restaurantId: restaurantId!,
              pictures: pictureKeys ?? [],
            },
            signal,
          });
      const nextId = result?.id ?? food?.id;
      if (nextId) navigate(`/foods/${nextId}`, { replace: true });
    });
  };
  const categories = options?.categories ?? [
    "主食",
    "菜",
    "小吃",
    "汤",
    "饮品甜品",
    "特色",
  ];
  const tags = options?.tags ?? ["辣", "麻", "甜", "酸", "清淡"];
  return (
    <section className="v2-panel v2-editor">
      <h1>{food ? "编辑菜品" : "添加菜品"}</h1>
      <form className="v2-form" onSubmit={submit}>
        <fieldset disabled={task.busy}>
          <label>
            名称
            <input
              name="name"
              required
              maxLength={30}
              defaultValue={food?.name}
            />
          </label>
          <label>
            分类
            <select
              name="category"
              required
              defaultValue={suggestion?.category ?? food?.category ?? ""}
            >
              <option value="" disabled>
                选择分类
              </option>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            价格
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={food?.price ?? ""}
            />
          </label>
          <label>
            描述
            <textarea
              name="description"
              maxLength={200}
              defaultValue={food?.description ?? ""}
            />
          </label>
          <label>
            图片
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => {
                files.current = Array.from(event.target.files ?? []).slice(
                  0,
                  options?.maxPictures ?? 6,
                );
              }}
            />
          </label>
          <fieldset className="v2-check-options">
            <legend>口味</legend>
            {tags.map((tag) => (
              <label className="v2-check" key={tag}>
                <input
                  type="checkbox"
                  name="tags"
                  value={tag}
                  defaultChecked={(suggestion?.tags ?? food?.tags)?.includes(
                    tag,
                  )}
                />
                {tag}
              </label>
            ))}
          </fieldset>
          <label className="v2-check">
            <input
              type="checkbox"
              name="signature"
              defaultChecked={food?.signature}
            />
            招牌菜
          </label>
          <div className="v2-actions">
            <button className="v2-primary" type="submit">
              {task.busy ? "保存中…" : "保存"}
            </button>
            <button
              type="button"
              disabled={suggest.busy}
              onClick={() => {
                const form =
                  document.activeElement?.closest("form") ??
                  document.querySelector(".v2-editor form");
                const data = form
                  ? new FormData(form as HTMLFormElement)
                  : new FormData();
                void suggest.run(async (signal) => {
                  const result = await call("postFoodsSuggestTags", {
                    body: {
                      restaurantId: restaurantId ?? food?.restaurantId,
                      name: String(data.get("name") ?? "").trim(),
                      description: String(data.get("description") ?? "").trim(),
                      pictures: [],
                    },
                    signal,
                  });
                  setSuggestion(result);
                }, "已生成建议，请确认后保存。");
              }}
            >
              AI 建议
            </button>
          </div>
        </fieldset>
      </form>
      <Notice {...task} />
      <Notice {...suggest} />
    </section>
  );
}

function FoodComments({
  foodId,
  canPost,
}: {
  foodId: number;
  canPost: boolean;
}) {
  const { call } = useV2();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["v2", "food", foodId, "comments", page],
    queryFn: ({ signal }) =>
      call("getFoodsByFoodIdComments", {
        path: { foodId },
        query: { sort: "NEWEST", page, pageSize: 20 },
        signal,
      }),
  });
  return (
    <section className="v2-panel">
      <h2>评论</h2>
      {canPost && (
        <CommentComposer foodId={foodId} done={() => query.refetch()} />
      )}
      <QueryState query={query} empty={!query.data?.items?.length}>
        <ul className="v2-comment-list">
          {query.data?.items?.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              refresh={() => query.refetch()}
            />
          ))}
        </ul>
      </QueryState>
      <PageControls
        page={page}
        hasNext={query.data?.hasNext}
        change={setPage}
      />
    </section>
  );
}

function CommentComposer({
  foodId,
  done,
}: {
  foodId: number;
  done: () => unknown;
}) {
  const { call, upload } = useV2();
  const files = useRef<File[]>([]);
  const task = useAction();
  return (
    <form
      className="v2-comment-compose"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const text = String(new FormData(form).get("text") ?? "").trim();
        void task.run(async (signal) => {
          const pictureKeys = await Promise.all(
            files.current
              .slice(0, 3)
              .map((file) => upload(file, "comments", signal)),
          );
          await call("postFoodsByFoodIdComments", {
            path: { foodId },
            body: { text, pictureKeys },
            signal,
          });
          form.reset();
          files.current = [];
          await done();
        }, "评论已发布。");
      }}
    >
      <textarea
        name="text"
        maxLength={200}
        placeholder="写评论"
        aria-label="评论内容"
      />
      <input
        type="file"
        multiple
        aria-label="评论图片"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => {
          files.current = Array.from(event.target.files ?? []).slice(0, 3);
        }}
      />
      <button disabled={task.busy}>发布</button>
      <Notice {...task} />
    </form>
  );
}

function CommentItem({
  comment,
  refresh,
}: {
  comment: Comment;
  refresh: () => unknown;
}) {
  const { call, user } = useV2();
  const task = useAction();
  const replies = useQuery({
    queryKey: ["v2", "comment", comment.id, "replies"],
    enabled: false,
    queryFn: ({ signal }) =>
      call("getCommentsByCommentIdReplies", {
        path: { commentId: comment.id! },
        query: { page: 1, pageSize: 100 },
        signal,
      }),
  });
  return (
    <li>
      <div className="v2-comment-head">
        <strong>{comment.author?.displayName || "食友"}</strong>
        <time>{dateTime(comment.createdAt)}</time>
      </div>
      {comment.text && <p>{comment.text}</p>}
      {!!comment.pictureUrls?.length && (
        <div className="v2-comment-pictures">
          {comment.pictureUrls.map((url) => (
            <Picture key={url} url={url} />
          ))}
        </div>
      )}
      <div className="v2-actions">
        <button
          disabled={task.busy}
          aria-pressed={comment.isLiked === true}
          onClick={() =>
            void task.run(async (signal) => {
              await call(
                comment.isLiked
                  ? "deleteCommentsByIdLike"
                  : "putCommentsByIdLike",
                { path: { id: comment.id! }, signal },
              );
              await refresh();
            })
          }
        >
          {comment.isLiked ? "已赞" : "赞"} {comment.likeCount || ""}
        </button>
        {!!comment.replyCount && (
          <button onClick={() => void replies.refetch()}>
            {comment.replyCount} 条回复
          </button>
        )}
        {(user?.role === "admin" || user?.id === comment.author?.id) && (
          <button
            disabled={task.busy}
            onClick={() =>
              confirm("删除这条评论及其回复？") &&
              void task.run(async (signal) => {
                await call("deleteCommentsByCommentId", {
                  path: { commentId: comment.id! },
                  signal,
                });
                await refresh();
              })
            }
          >
            删除
          </button>
        )}
      </div>
      {replies.data?.items?.map((reply) => (
        <p className="v2-comment-reply" key={reply.id}>
          <strong>{reply.author?.displayName}</strong> {reply.text}
        </p>
      ))}
      <Notice {...task} />
    </li>
  );
}

function FoodGallery({ foodId }: { foodId: number }) {
  const { call } = useV2();
  const gallery = useQuery({
    queryKey: ["v2", "food", foodId, "gallery"],
    queryFn: ({ signal }) =>
      call("getFoodsByFoodIdGallery", {
        path: { foodId },
        query: { page: 1, pageSize: 12 },
        signal,
      }),
  });
  if (!gallery.isPending && !gallery.error && !gallery.data?.items?.length)
    return null;
  return (
    <section className="v2-panel">
      <h2>食友图片</h2>
      <QueryState query={gallery}>
        <div className="v2-food-wall">
          {gallery.data?.items?.map((picture) => (
            <Picture
              key={`${picture.commentId}:${picture.slot}`}
              url={picture.url}
            />
          ))}
        </div>
      </QueryState>
    </section>
  );
}

function FoodHistory({
  foodId,
  editable,
  refresh,
}: {
  foodId: number;
  editable: boolean;
  refresh: () => Promise<void>;
}) {
  const { call } = useV2();
  const task = useAction();
  const history = useQuery({
    queryKey: ["v2", "food", foodId, "history"],
    queryFn: ({ signal }) =>
      call("getFoodsByIdHistory", {
        path: { id: foodId },
        query: { page: 1, pageSize: 20 },
        signal,
      }),
  });
  return (
    <section className="v2-panel">
      <h2>修改历史</h2>
      <QueryState query={history} empty={!history.data?.items?.length}>
        <ul className="v2-list">
          {history.data?.items?.map((row) => (
            <li key={row.id}>
              <span>
                {row.editor?.displayName || "食友"} · {dateTime(row.createdAt)}
              </span>
              {editable && (
                <button
                  disabled={task.busy}
                  onClick={() =>
                    confirm("将菜品恢复到这个版本？") &&
                    void task.run(async (signal) => {
                      await call("postFoodsByIdHistoryByRevisionIdRestore", {
                        path: { id: foodId, revisionId: row.id! },
                        signal,
                      });
                      await Promise.all([refresh(), history.refetch()]);
                    }, "菜品已恢复。")
                  }
                >
                  恢复
                </button>
              )}
            </li>
          ))}
        </ul>
      </QueryState>
      <Notice {...task} />
    </section>
  );
}
