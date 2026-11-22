import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Image as ImageIcon } from "lucide-react";
import { useApp } from "../app/state";
import { mediaUrl } from "../api/models";
import { FoodCover } from "../components/FoodCover";
import "./profile-cover-picker.css";

export function ProfileCoverPicker({
  value,
  onChange,
  disabled,
}: {
  value?: number;
  onChange: (id: number) => void;
  disabled: boolean;
}) {
  const { api, user } = useApp();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const selectedId = value ?? user?.coverFoodId ?? undefined;
  const selected = useQuery({
    queryKey: ["foods", "my-cover", user?.id, selectedId],
    queryFn: () => api.myFoods(1, selectedId),
    enabled: !!user?.id && !!selectedId,
  });
  const choices = useQuery({
    queryKey: ["foods", "mine", page],
    queryFn: () => api.myFoods(page),
    enabled: !!user?.id && open,
  });
  const dishes =
    choices.data?.items?.filter((food) => food.id && food.pictureUrl?.[0]) ??
    [];
  const current =
    selected.data?.items?.find((food) => food.id === selectedId) ??
    dishes.find((food) => food.id === selectedId);
  const src = mediaUrl(current?.pictureUrl?.[0]);
  return (
    <div className="profile-cover-picker">
      <button
        type="button"
        className="profile-cover-trigger"
        ref={trigger}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span className="profile-cover-sample">
          {src ? (
            <FoodCover src={src} crop={current?.coverCrop} alt="" />
          ) : (
            <ImageIcon size={22} aria-hidden="true" />
          )}
        </span>
        <span>
          <strong>主页封面</strong>
          <small>
            {current?.name ||
              (selectedId && !selected.isSuccess ? "已选菜品" : "自动选择")}
          </small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div id={panelId} hidden={!open}>
        {open && (
          <>
            {choices.isPending ? (
              <p role="status">正在加载我的菜品…</p>
            ) : choices.isError ? (
              <p role="status">
                菜品加载失败{" "}
                <button type="button" onClick={() => void choices.refetch()}>
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
                    disabled={disabled}
                    aria-pressed={food.id === selectedId}
                    onClick={() => {
                      onChange(food.id!);
                      setOpen(false);
                      trigger.current?.focus();
                    }}
                  >
                    <span>
                      <FoodCover
                        src={mediaUrl(food.pictureUrl?.[0])}
                        crop={food.coverCrop}
                        alt=""
                      />
                      {food.id === selectedId && (
                        <Check size={18} aria-hidden="true" />
                      )}
                    </span>
                    <strong>{food.name}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p role="status">
                {choices.data?.totalItems
                  ? "这一页没有带封面的菜品"
                  : "分享一道带照片的菜后，就可以把它设为封面。"}
              </p>
            )}
            {(page > 1 || choices.data?.hasNext) && (
              <nav aria-label="封面菜品分页">
                <button
                  type="button"
                  disabled={page === 1 || disabled}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </button>
                <span aria-live="polite">第 {page} 页</span>
                <button
                  type="button"
                  disabled={!choices.data?.hasNext || disabled}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
