import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { categories, money, parseId, type Food } from "../api/models";
import {
  Empty,
  ErrorState,
  Gate,
  Icon,
  Intro,
  Loading,
  Modal,
  Picture,
  Pagination,
} from "../components/ui";
import { useFoodActions } from "../components/FoodCard";
import { useTask } from "../components/useTask";
export default function FoodDetail() {
  const id = parseId(useParams().id);
  return (
    <Gate>
      {id ? (
        <FoodContent id={id} />
      ) : (
        <Empty
          title="菜品地址无效"
          action={
            <Link to="/" className="btn btn-primary">
              返回发现
            </Link>
          }
        >
          请从列表重新打开菜品。
        </Empty>
      )}
    </Gate>
  );
}
function FoodContent({ id }: { id: number }) {
  const { api } = useApp(),
    [tagOpen, setTagOpen] = useState(false),
    [image, setImage] = useState(0);
  const q = useQuery({
    queryKey: ["foods", "detail", id],
    queryFn: () => api.food(id),
  });
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const food = q.data;
  return (
    <>
      <Intro
        title="每一份好味道，都值得被记住。"
        subtitle="同学的真实分享，你的下一餐灵感。"
      />
      <div className="detail-page">
        <div className="detail-gallery">
          <div className="detail-main-image">
            <Picture
              src={food.pictureUrl?.[image] ?? food.pictureUrl?.[0]}
              alt={food.name || "菜品"}
              eager
            />
          </div>
          {(food.pictureUrl?.length ?? 0) > 1 && (
            <div className="detail-thumbnails">
              {food.pictureUrl?.map((src, i) => (
                <button
                  key={i}
                  aria-label={`查看第${i + 1}张图片`}
                  aria-pressed={image === i}
                  onClick={() => setImage(i)}
                >
                  <Picture src={src} alt={`菜品图片${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-content">
          <span className="eyebrow">同学的美味日常</span>
          <h2>{food.name || "未命名菜品"}</h2>
          <div className="detail-price">{money(food.price)}</div>
          <div className="food-tags">
            {(food.categoryLabel || food.category) && (
              <span className="food-tag warm">
                {food.categoryLabel ||
                  categories.find((c) => c.id === food.category)?.label ||
                  food.category}
              </span>
            )}
            {food.systemTags?.map((t, i) => (
              <span className="food-tag" key={t.id ?? i}>
                {t.name}
                {t.count != null ? ` · ${t.count}` : ""}
              </span>
            ))}
          </div>
          <p className="detail-description">
            {food.description || "分享者还没有留下描述，试试看这份美味吧。"}
          </p>
          {food.restaurantId && (
            <Link
              to={`/restaurants/${food.restaurantId}`}
              className="detail-store"
            >
              <Icon name="store" />
              <div>
                <strong>{food.restaurantName || "查看餐厅"}</strong>
                <small>去看看这家店的其他好味道</small>
              </div>
              <Icon name="arrow" />
            </Link>
          )}
          <div className="detail-author">
            <span className="avatar">
              {food.uploaderName?.slice(0, 1) || "食"}
            </span>
            <span>
              {food.accountId ? (
                <Link to={`/users/${food.accountId}`}>
                  {food.uploaderName || "同学"}
                </Link>
              ) : (
                food.uploaderName || "同学"
              )}
              <small>认真分享这一餐</small>
            </span>
          </div>
          <DetailActions food={food} />
          <button
            className="btn btn-secondary"
            onClick={() => setTagOpen(true)}
          >
            <Icon name="folder" />
            给这道菜做分类
          </button>
          {!!food.myCustomTags?.length && (
            <p className="section-caption">
              我的分类：{food.myCustomTags.map((t) => t.name).join("、")}
            </p>
          )}
        </div>
      </div>
      {tagOpen && (
        <Modal
          title="下次想吃，找起来更容易。"
          onClose={() => setTagOpen(false)}
        >
          <TagEditor id={id} />
        </Modal>
      )}
    </>
  );
}
function DetailActions({ food }: { food: Food }) {
  const a = useFoodActions(food);
  return (
    <div className="detail-actions">
      <button
        className={`btn ${food.isFavorite ? "btn-lime" : "btn-primary"}`}
        disabled={a.busy || food.isFavorite == null}
        onClick={a.favorite}
        aria-pressed={food.isFavorite ?? false}
      >
        <Icon name="bookmark" />
        {food.isFavorite ? "已收藏" : "收藏这道菜"}
      </button>
      <button
        className="btn btn-secondary"
        disabled={a.busy || food.isLiked == null}
        onClick={a.like}
        aria-pressed={food.isLiked ?? false}
      >
        <Icon name="heart" />
        {food.isLiked ? "已喜欢" : "喜欢"} · {food.likesCount ?? "—"}
      </button>
    </div>
  );
}
function TagEditor({ id }: { id: number }) {
  const { api } = useApp(),
    [name, setName] = useState(""),
    [myTagPage, setMyTagPage] = useState(1);
  const mine = useQuery({
    queryKey: ["my-tags", myTagPage],
    queryFn: () => api.myTags(myTagPage),
  });
  const tags = useQuery({
      queryKey: ["food-tags", id],
      queryFn: () => api.foodTags(id),
    }),
    system = useQuery({
      queryKey: ["system-tags"],
      queryFn: () => api.systemTags(),
    });
  const task = useTask("分类已更新", () => setName(""), [
    "foods",
    "food-tags",
    "my-tags",
  ]);
  return (
    <>
      <p className="muted modal-description">
        个人分类帮你整理菜品。添加分类不会自动收藏，请单独点击收藏。
      </p>
      {tags.isPending ? (
        <Loading />
      ) : tags.isError ? (
        <ErrorState error={tags.error} retry={() => void tags.refetch()} />
      ) : (
        <>
          <h3 className="form-label">我的分类</h3>
          <div className="tag-editor-list">
            {tags.data.myCustomTags?.map((t) => (
              <span className="editable-tag" key={t.id}>
                {t.name}
                <button
                  aria-label={`移除分类${t.name}`}
                  disabled={task.isPending || !t.id}
                  onClick={() => task.run(() => api.removeTag(id, t.id!))}
                >
                  <Icon name="close" />
                </button>
              </span>
            ))}
            {!tags.data.myCustomTags?.length && (
              <span className="muted">还没有分类</span>
            )}
          </div>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim())
                task.run(() => api.addCustomTags(id, [name.trim()]));
            }}
          >
            <input
              className="field"
              aria-label="新分类名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              placeholder="比如：想吃清单"
              required
            />
            <button
              className="btn btn-primary"
              disabled={task.isPending || !name.trim()}
            >
              添加
            </button>
          </form>
          <h3 className="form-label tag-section-title">选一个已有分类</h3>
          {mine.isPending ? (
            <Loading />
          ) : mine.isError ? (
            <ErrorState error={mine.error} retry={() => void mine.refetch()} />
          ) : (
            <>
              <div className="tag-editor-list">
                {mine.data.items?.map((t) => {
                  const exists = tags.data.myCustomTags?.some(
                    (x) => x.id === t.id,
                  );
                  return (
                    <button
                      key={t.id}
                      className={`chip ${exists ? "active" : ""}`}
                      disabled={task.isPending || exists || !t.name}
                      onClick={() =>
                        task.run(() => api.addCustomTags(id, [t.name!]))
                      }
                    >
                      {exists && <Icon name="check" />}
                      {t.name}
                    </button>
                  );
                })}
                {!mine.data.items?.length && (
                  <span className="muted">
                    还没有分类，在上方输入一个名称吧。
                  </span>
                )}
              </div>
              <Pagination
                page={myTagPage}
                hasNext={mine.data.hasNext}
                totalPages={mine.data.totalPages}
                onPage={setMyTagPage}
              />
            </>
          )}
          <h3 className="form-label tag-section-title">公共口味标签</h3>
          <p className="section-caption">
            选择一个适合的标签，给其他同学一点参考。
          </p>
          {system.isPending ? (
            <Loading />
          ) : system.isError ? (
            <ErrorState
              error={system.error}
              retry={() => void system.refetch()}
            />
          ) : (
            <>
              <div className="tag-editor-list">
                {system.data.map((t) => {
                  const marked = tags.data.systemTags?.some(
                    (s) => s.id === t.id && s.taggedByMe,
                  );
                  return (
                    <button
                      className={`chip ${marked ? "active" : ""}`}
                      disabled={task.isPending || !t.id}
                      key={t.id}
                      onClick={() =>
                        task.run(() =>
                          marked
                            ? api.removeTag(id, t.id!)
                            : api.addSystemTags(id, [t.id!]),
                        )
                      }
                    >
                      {marked && <Icon name="check" />}
                      {t.name}
                      {marked ? " · 撤销我的标记" : ""}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
      {task.error && <ErrorState error={task.error} />}
    </>
  );
}
