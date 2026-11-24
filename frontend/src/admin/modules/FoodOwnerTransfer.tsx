import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import type { Food, Schema } from "../../api/models";
import { useTask } from "../../components/useTask";
import {
  Async,
  Avatar,
  Confirm,
  Drawer,
  Field,
  Icon,
  Meta,
  Notice,
  Pager,
} from "../kit";

type Person = Schema["UserListItemVOResponse"];
const reasonLimit = 200;

/** Picks a new first publisher for a dish, then confirms the move. */
export function FoodOwnerTransfer({
  food,
  onClose,
}: {
  food: Food;
  onClose: () => void;
}) {
  const { api, toast } = useApp(),
    cache = useQueryClient(),
    [search, setSearch] = useState({ keyword: "", page: 1 }),
    [target, setTarget] = useState<Person | null>(null),
    [reason, setReason] = useState(""),
    [confirming, setConfirming] = useState(false);
  const q = useQuery({
    queryKey: ["admin", "users", "owner-transfer", search],
    queryFn: () => api.adminUsers(search.page, { keyword: search.keyword }),
    enabled: !!search.keyword,
  });
  const task = useTask(undefined, onClose, ["foods", "admin"]);
  const owner = food.uploaderName?.trim() || (food.accountId ? `#${food.accountId}` : "无（原分享者已注销）");
  const name = target?.displayName?.trim() || `#${target?.id}`;
  const tooLong = Array.from(reason.trim()).length > reasonLimit;
  /** Why this person cannot receive the dish, if so. */
  const blocked = (u: Person) =>
    u.id === food.accountId
      ? "当前分享者"
      : u.accountStatus?.bannedAt ||
          /ban/i.test(u.accountStatus?.accountStatus ?? "")
        ? "封禁中"
        : undefined;
  const submit = () =>
    task.run(async () => {
      try {
        const result = await api.transferFoodOwner(
          food.id!,
          target!.id!,
          reason.trim() || undefined,
        );
        toast(
          `已转给${name}，随菜品转移 ${result?.experience ?? 0} 点经验` +
            (result?.droppedExperience
              ? `，另有 ${result.droppedExperience} 点不计入`
              : "") +
            "。",
          { tone: "success" },
        );
      } catch (error) {
        // The request may have gone through, so show the dish's real owner.
        setConfirming(false);
        void cache.invalidateQueries({ queryKey: ["foods"] });
        throw error;
      }
    });
  return (
    <>
      <Drawer
        title="转移菜品归属"
        subtitle={`${food.name} · #${food.id}`}
        onClose={() => !task.isPending && onClose()}
        footer={
          <>
            <button
              type="button"
              className="ew-admin-btn"
              disabled={task.isPending}
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="ew-admin-btn is-primary"
              disabled={!target || tooLong || task.isPending}
              onClick={() => setConfirming(true)}
            >
              转移归属
            </button>
          </>
        }
      >
        <div className="ew-admin-transfer">
          <Meta
            items={[
              ["当前分享者", owner],
              ["餐厅", food.restaurantName || "—"],
            ]}
          />
          <Notice>
            菜品会归到新分享者名下，原分享者因它获得的发布与被赞经验一并转移。新分享者自己点的赞不计经验。菜品内容、点赞、收藏和评分不变。
          </Notice>
          <form
            className="ew-admin-toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              const keyword = String(
                new FormData(e.currentTarget).get("keyword") || "",
              ).trim();
              setTarget(null);
              setSearch({ keyword, page: 1 });
            }}
          >
            <label className="ew-admin-search">
              <Icon name="search" size={17} />
              <input
                name="keyword"
                aria-label="搜索新分享者"
                placeholder="昵称，或完整的登录名 / 手机号 / 学号"
                required
              />
            </label>
            <button className="ew-admin-btn">查找</button>
          </form>
          {search.keyword && (
            <Async
              query={q}
              empty={!q.data?.items?.length}
              emptyTitle="没有找到用户"
              emptyHint="登录名、手机号和学号需要输入完整内容。"
            >
              <fieldset className="ew-admin-people">
                <legend className="sr-only">新分享者</legend>
                {q.data?.items?.map((u) => {
                  const why = blocked(u);
                  return (
                    <label key={u.id}>
                      <input
                        type="radio"
                        name="owner"
                        disabled={!!why}
                        checked={target?.id === u.id}
                        onChange={() => setTarget(u)}
                      />
                      <Avatar src={u.avatar} name={u.displayName} />
                      <span>
                        {u.displayName || "未设置昵称"}
                        <small>
                          #{u.id}
                          {u.userName ? ` · ${u.userName}` : ""}
                          {why ? ` · ${why}` : ""}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <Pager
                page={search.page}
                total={q.data?.totalItems}
                totalPages={q.data?.totalPages}
                hasNext={q.data?.hasNext}
                onChange={(page) => {
                  setTarget(null);
                  setSearch({ ...search, page });
                }}
              />
            </Async>
          )}
          <Field
            label="转移原因（选填）"
            hint={
              tooLong
                ? `最多 ${reasonLimit} 字，请缩短后再提交。`
                : "只保存在转移记录中。"
            }
          >
            <textarea
              rows={3}
              value={reason}
              aria-invalid={tooLong || undefined}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
      </Drawer>
      {confirming && target && (
        <Confirm
          title={`把「${food.name}」转给${name}？`}
          confirmLabel="确认转移"
          busy={task.isPending}
          onClose={() => !task.isPending && setConfirming(false)}
          onConfirm={submit}
        >
          由「{owner}」转给「{name}」（#{target.id}
          ）。经验会立即调整，再转回来也不保证完全还原。
        </Confirm>
      )}
    </>
  );
}
