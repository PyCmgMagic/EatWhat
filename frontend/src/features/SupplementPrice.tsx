import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { errorMessage } from "../api/client";
import { foodPrice } from "../api/content-rules";
import { Modal } from "../components/ui";
import { useActionAccess } from "./access";
import "./v4/confirm-dialog.css";
import "./supplement-price.css";

/**
 * "补充价格" next to "价格待补充": whoever has eaten the dish fills in just the
 * price. It is an ordinary dish edit, so it goes into the edit history.
 */
export function SupplementPrice({
  food,
}: {
  food: { id?: number | null; name?: string | null; price?: number | null };
}) {
  const { api, toast } = useApp(),
    cache = useQueryClient(),
    access = useActionAccess(),
    [open, setOpen] = useState(false),
    [trigger, setTrigger] = useState<HTMLElement | null>(null),
    [value, setValue] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (food.price != null || !food.id) return null;
  const submit = async () => {
    if (busy) return;
    setError("");
    let price: number;
    try {
      price = foodPrice(value);
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    setBusy(true);
    try {
      await api.editMyFood(food.id!, { price });
      await cache.invalidateQueries({ queryKey: ["foods"] });
      setOpen(false);
      toast("价格已补充，谢谢你");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className="supplement-price-button"
        onClick={(e) => {
          if (!access(true)) return;
          setTrigger(e.currentTarget);
          setValue("");
          setError("");
          setOpen(true);
        }}
      >
        补充价格
      </button>
      {open && (
        <Modal
          title="补充价格"
          className="v4-confirm-dialog supplement-price-dialog"
          dismissible={!busy}
          returnFocus={trigger}
          motionOrigin={trigger}
          onClose={() => setOpen(false)}
        >
          {(dismiss) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <p>
                吃过「{food.name || "这道菜"}
                」？填上你付的价格，帮后来的人参考。
              </p>
              <label className="supplement-price-field">
                <span aria-hidden="true">¥</span>
                <input
                  aria-label="价格（元）"
                  inputMode="decimal"
                  autoFocus
                  placeholder="如 18"
                  value={value}
                  disabled={busy}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
              {error && (
                <p className="supplement-price-error" role="alert">
                  {error}
                </p>
              )}
              <div className="v4-confirm-actions">
                <button type="button" disabled={busy} onClick={dismiss}>
                  取消
                </button>
                <button type="submit" className="is-danger" disabled={busy}>
                  {busy ? "正在保存…" : "保存"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
