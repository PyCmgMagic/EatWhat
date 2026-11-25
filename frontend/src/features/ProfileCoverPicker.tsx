import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { errorMessage } from "../api/client";
import { mediaUrl, type Food, type User } from "../api/models";
import { useApp } from "../app/state";
import { sessionSignal } from "../app/runtime";
import { FoodCover } from "../components/FoodCover";
import { Modal } from "../components/ui";
import SheetHandle from "../mobile/SheetHandle";
import "./profile-cover-picker.css";

export function ProfileCoverPicker({
  displayedId,
}: {
  displayedId?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="profile-cover-background"
        aria-label="更换主页封面"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      />
      {open &&
        createPortal(
          <CoverSheet
            displayedId={displayedId}
            returnFocus={trigger.current}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

function CoverSheet({
  displayedId,
  returnFocus,
  onClose,
}: {
  displayedId?: number | null;
  returnFocus: HTMLButtonElement | null;
  onClose: () => void;
}) {
  const { api, user, session, toast } = useApp();
  const cache = useQueryClient();
  const currentId = displayedId ?? user?.coverFoodId;
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState<number>();
  const [error, setError] = useState("");
  const pending = useRef(false);
  const choices = useQuery({
    queryKey: ["foods", "mine", page],
    queryFn: () => api.myFoods(page),
    enabled: !!user?.id,
  });
  const dishes =
    choices.data?.items?.filter((food) => food.id && food.pictureUrl?.[0]) ??
    [];

  async function choose(food: Food) {
    if (pending.current || !user?.id || !food.id) return;
    if (food.id === user.coverFoodId) {
      onClose();
      return;
    }
    pending.current = true;
    setSaving(food.id);
    setError("");
    const owner = sessionSignal(session);
    try {
      await api.updateProfile({ coverFoodId: food.id });
      await cache.cancelQueries({ queryKey: ["me"], exact: true });
      owner.throwIfAborted();
      cache.setQueryData(["foods", "my-cover", user.id, food.id], {
        items: [food],
        totalItems: 1,
        hasNext: false,
      });
      cache.setQueryData<User>(["me"], (current) => ({
        ...(current ?? user),
        coverFoodId: food.id,
      }));
      void cache.invalidateQueries({ queryKey: ["user", user.id] });
      void cache.invalidateQueries({
        queryKey: ["growth", user.id, "leaderboard"],
      });
      toast("主页封面已更换");
      onClose();
    } catch (cause) {
      if (!owner.aborted) setError(errorMessage(cause));
    } finally {
      pending.current = false;
      setSaving(undefined);
    }
  }

  return (
    <Modal
      title="更换主页封面"
      className="profile-cover-sheet"
      onClose={onClose}
      returnFocus={returnFocus}
      dismissible={!saving}
    >
      <SheetHandle
        mode="dismiss"
        target=".profile-cover-sheet"
        label="封面选择"
        onDismiss={onClose}
        disabled={!!saving}
      />
      <div
        className="profile-cover-contents"
        aria-busy={choices.isPending || !!saving}
      >
        {choices.isPending ? (
          <p role="status">正在加载我的菜品…</p>
        ) : choices.isError ? (
          <p role="status">
            菜品加载失败{" "}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void choices.refetch()}
            >
              重试
            </button>
          </p>
        ) : dishes.length ? (
          <div
            className="profile-cover-choices"
            role="group"
            aria-label="选择我的菜品封面"
          >
            {dishes.map((food) => (
              <button
                type="button"
                key={food.id}
                disabled={!!saving}
                aria-pressed={food.id === currentId}
                onClick={() => void choose(food)}
              >
                <span className="profile-cover-thumb">
                  <FoodCover
                    src={mediaUrl(food.pictureUrl?.[0])}
                    crop={food.coverCrop}
                    alt=""
                  />
                  {food.id === currentId && (
                    <span className="profile-cover-check">
                      <Check size={15} />
                    </span>
                  )}
                </span>
                <strong>{food.name || "未命名菜品"}</strong>
              </button>
            ))}
          </div>
        ) : (
          <p role="status">
            {page > 1 || choices.data?.totalItems || choices.data?.hasNext
              ? "这一页没有带照片的菜品。"
              : "分享一道带照片的菜后，就可以把它设为封面。"}
          </p>
        )}
      </div>
      {saving && (
        <p className="profile-cover-feedback" role="status">
          正在更换封面…
        </p>
      )}
      {error && (
        <p className="profile-cover-feedback" role="alert">
          {error}
        </p>
      )}
      {(page > 1 || choices.data?.hasNext) && (
        <nav aria-label="封面菜品分页">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={page === 1 || !!saving}
            onClick={() => {
              setError("");
              setPage(page - 1);
            }}
          >
            上一页
          </button>
          <span aria-live="polite">第 {page} 页</span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!choices.data?.hasNext || !!saving}
            onClick={() => {
              setError("");
              setPage(page + 1);
            }}
          >
            下一页
          </button>
        </nav>
      )}
    </Modal>
  );
}
