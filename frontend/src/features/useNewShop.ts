import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { MapPlace } from "../api/baidu-places";
import { resultUncertain } from "../api/client";
import { boundedText, codePoints } from "../api/content-rules";
import { useArea } from "../app/area";
import { usePageLifetime } from "../app/drafts";
import { useApp } from "../app/state";
import { useTask } from "../components/useTask";
import { useMobile } from "../mobile/ui";
import { requireShopLocation } from "./RestaurantLocationField";
import type { MapPoint } from "./map-geometry";
import { defaultShopTraits, type ShopTraits } from "./ShopTraits";

const searchPath = "/restaurants/new";
const detailsPath = "/restaurants/new/details";

type ShopChoice = { keyword: string; place?: MapPlace };
type ShopDraft = {
  choice: ShopChoice;
  name: string;
  address: string;
  point?: MapPoint;
  traits: ShopTraits;
  uncertain: boolean;
};
const desktopDrafts = new Map<number, ShopDraft>();

function manualName(keyword: string) {
  return [...keyword.trim()].slice(0, 20).join("");
}

function draftFor(choice: ShopChoice): ShopDraft {
  return {
    choice,
    name: choice.place?.name ?? manualName(choice.keyword),
    address: choice.place?.address ?? "",
    point: choice.place?.point,
    traits: defaultShopTraits(),
    uncertain: false,
  };
}

function sameShop(a: ShopChoice, b: ShopChoice) {
  return a.place || b.place
    ? a.place?.id === b.place?.id
    : manualName(a.keyword) === manualName(b.keyword);
}

export function useNewShop(rememberDraft = false) {
  const { api, user, toast } = useApp();
  const { area } = useArea();
  const m = useMobile();
  const nav = useNavigate();
  const location = useLocation();
  const active = usePageLifetime();
  const task = useTask();
  const details = location.pathname === detailsPath;
  const choice = details ? (location.state as ShopChoice | null) : null;
  const owner = rememberDraft ? (user?.id ?? undefined) : undefined;
  const saved = owner === undefined ? undefined : desktopDrafts.get(owner);
  const nameHint = m.draft.restaurantId ? "" : (m.draft.shopName ?? "");
  const [keyword, setKeyword] = useState(
    () => choice?.keyword ?? saved?.choice.keyword ?? nameHint,
  );
  const [draft, setDraft] = useState(() =>
    saved && (!choice || sameShop(saved.choice, choice))
      ? saved
      : draftFor(choice ?? { keyword: nameHint }),
  );
  const currentDraft = useRef(draft);
  const formRef = useRef<HTMLFormElement>(null);

  function update(patch: Partial<ShopDraft>) {
    const next = { ...currentDraft.current, ...patch };
    currentDraft.current = next;
    if (owner !== undefined) desktopDrafts.set(owner, next);
    setDraft(next);
  }

  useEffect(() => {
    if (details) formRef.current?.focus({ preventScroll: true });
  }, [details]);

  const dirty = !!(draft.name || draft.address || draft.point);
  useEffect(() => {
    if (!rememberDraft || !dirty) return;
    function leave(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [rememberDraft, dirty]);

  const busy = task.isPending || draft.uncertain;
  const canSubmit =
    !busy &&
    !!draft.point &&
    !!draft.name.trim() &&
    !!draft.address.trim() &&
    codePoints(draft.name.trim()) <= 20 &&
    codePoints(draft.address.trim()) <= 30 &&
    draft.traits.mealTimes.length > 0;

  function select(place?: MapPlace) {
    if (busy) return;
    const next = { keyword, place };
    if (!sameShop(draft.choice, next)) update(draftFor(next));
    task.reset();
    nav(detailsPath, { state: next });
  }

  function back() {
    if (task.isPending) return;
    if (draft.uncertain || !details) nav("/publish");
    else if (choice) nav(-1);
    else nav(searchPath, { replace: true });
  }

  function submit() {
    if (!canSubmit) return;
    task.run(async () => {
      try {
        const name = boundedText(draft.name, 20, "店名");
        const created = await api.createRestaurant({
          name,
          address: boundedText(draft.address, 30, "地址"),
          ...requireShopLocation(draft.point),
          hubId: area?.hubId,
          ...draft.traits,
        });
        if (owner !== undefined) desktopDrafts.delete(owner);
        if (!active.current) return;
        if (created.revisionId) {
          toast("新店已提交，等待审核。");
          nav("/publish", { replace: true });
          return;
        }
        m.setShopId(created.id);
        m.setDraft({ restaurantId: created.id, shopName: name });
        nav("/publish/dish", { replace: true });
      } catch (error) {
        if (resultUncertain(error)) update({ uncertain: true });
        throw error;
      }
    });
  }

  return {
    details,
    keyword,
    setKeyword,
    select,
    back,
    draft,
    update,
    submit,
    busy,
    canSubmit,
    pending: task.isPending,
    formRef,
  };
}
