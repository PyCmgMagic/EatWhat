import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { type CustomTag } from "../api/models";
import {
  Empty,
  ErrorState,
  Gate,
  Icon,
  Intro,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import { FoodGrid } from "../components/FoodCard";
import { useTask } from "../components/useTask";
export default function Favorites() {
  return (
    <>
      <Intro
        title="喜欢的味道，留给下一次。"
        subtitle="把心动收藏起来，下次吃饭就有了方向。"
      />
      <Gate>
        <FavoriteContent />
      </Gate>
    </>
  );
}
function FavoriteContent() {
  const { api } = useApp(),
    [page, setPage] = useState(1),
    [tagPage, setTagPage] = useState(1),
    [filter, setFilter] = useState<number>(),
    [edit, setEdit] = useState<CustomTag | null>(null);
  const q = useQuery({
      queryKey: ["foods", "favorites", page],
      queryFn: () => api.favorites(page),
    }),
    tags = useQuery({
      queryKey: ["my-tags", tagPage],
      queryFn: () => api.myTags(tagPage),
    });
  const foods =
    q.data?.items?.filter(
      (f) => !filter || f.myCustomTags?.some((t) => t.id === filter),
    ) ?? [];
  return (
    <>
      {tags.isPending ? (
        <Loading />
      ) : tags.isError ? (
        <ErrorState error={tags.error} retry={() => void tags.refetch()} />
      ) : (
        <>
          <div className="section-title">
            <h2>我的口味小档案</h2>
            <span className="muted">在菜品详情里添加个人分类</span>
          </div>
          <div className="collection-grid">
            {tags.data.items?.map((tag, i) => (
              <article
                className={`collection-card collection-${i % 3}`}
                key={tag.id}
              >
                <button
                  className="collection-edit"
                  onClick={() => setEdit(tag)}
                  aria-label={`管理分类${tag.name}`}
                >
                  <Icon name="edit" />
                </button>
                <button
                  className="collection-main"
                  onClick={() =>
                    setFilter((t) =>
                      t === tag.id ? undefined : (tag.id ?? undefined),
                    )
                  }
                  aria-pressed={filter === tag.id}
                >
                  <span className="collection-art">
                    <Icon name="folder" />
                    <span>✳</span>
                  </span>
                  <h3>{tag.name}</h3>
                  <p>{tag.usageCount ?? "—"} 道菜使用了这个分类</p>
                </button>
              </article>
            ))}
          </div>
          <Pagination
            page={tagPage}
            hasNext={tags.data.hasNext}
            totalPages={tags.data.totalPages}
            onPage={setTagPage}
          />
        </>
      )}
      <div className="section-title favorite-section-title">
        <h2>收藏的好味道</h2>
        <button
          className={`chip ${!filter ? "active" : ""}`}
          onClick={() => setFilter(undefined)}
        >
          全部收藏
        </button>
      </div>
      {filter && (
        <div className="info-strip">
          <Icon name="info" />
          <span>
            正在筛选本页的「
            {tags.data?.items?.find((t) => t.id === filter)?.name || "所选分类"}
            」。翻页可继续查找。
          </span>
          <button onClick={() => setFilter(undefined)}>清除</button>
        </div>
      )}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : foods.length ? (
        <FoodGrid foods={foods} />
      ) : (
        <Empty
          title={filter ? "这一页还没有对应的收藏" : "想吃清单，等一份心动"}
          action={
            filter ? (
              <button
                className="btn btn-secondary"
                onClick={() => setFilter(undefined)}
              >
                查看本页全部
              </button>
            ) : (
              <Link to="/" className="btn btn-primary">
                去发现好吃的
                <Icon name="arrow" />
              </Link>
            )
          }
        >
          {filter
            ? "可以翻页查找，或清除分类继续浏览。"
            : "看到喜欢的菜品，点击书签，就能在这里找到。"}
        </Empty>
      )}
      <Pagination
        page={page}
        hasNext={q.data?.hasNext}
        totalPages={q.data?.totalPages}
        onPage={setPage}
      />
      {edit && (
        <Modal title="整理我的分类" onClose={() => setEdit(null)}>
          <EditTag tag={edit} onClose={() => setEdit(null)} />
        </Modal>
      )}
    </>
  );
}
function EditTag({ tag, onClose }: { tag: CustomTag; onClose: () => void }) {
  const { api } = useApp(),
    [name, setName] = useState(tag.name || ""),
    [deleting, setDeleting] = useState(false);
  const task = useTask("分类已更新", onClose, [
    "my-tags",
    "foods",
    "food-tags",
  ]);
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && tag.id)
            task.run(() => api.renameTag(tag.id!, name.trim()));
        }}
      >
        <label className="form-label" htmlFor="tag-name">
          分类名称
        </label>
        <input
          className="field"
          id="tag-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          required
        />
        <div className="modal-actions">
          <button
            className="btn btn-primary"
            disabled={task.isPending || !name.trim()}
          >
            保存名称
          </button>
          <button
            className="btn btn-quiet"
            type="button"
            disabled={task.isPending}
            onClick={() => setDeleting(true)}
          >
            删除分类
          </button>
        </div>
      </form>
      {deleting && (
        <div className="info-strip danger-strip">
          <p>
            删除「{tag.name}」会解除所有菜品上的这个个人分类，收藏本身保留。
          </p>
          <button
            className="btn btn-secondary"
            disabled={task.isPending}
            onClick={() => tag.id && task.run(() => api.deleteTag(tag.id!))}
          >
            确认删除分类
          </button>
        </div>
      )}
      {task.error && <ErrorState error={task.error} />}
    </>
  );
}
