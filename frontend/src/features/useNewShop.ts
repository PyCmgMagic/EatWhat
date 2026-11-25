import { reportWebUsage } from "../app/web-usage";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { MapPlace } from "../api/baidu-places";
import { errorMessage, resultUncertain } from "../api/client";
import {
  boundedText,
  codePoints,
  restaurantAddressLimit,
  restaurantDescriptionLimit,
} from "../api/content-rules";
import { useArea } from "../app/area";
import { usePageLifetime } from "../app/drafts";
import { useApp } from "../app/state";
import { useTask } from "../components/useTask";
import { useMobile } from "../mobile/ui";
import { requireShopLocation } from "./RestaurantLocationField";
import type { MapPoint } from "./map-geometry";
import type { ShopPhotoSelection } from "./shop-photo-edit";
import { defaultShopTraits, type ShopTraits } from "./ShopTraits";

const searchPath = "/restaurants/new";
const detailsPath = "/restaurants/new/details";

type ShopChoice = { keyword: string; place?: MapPlace };
type ShopDraft = {
  choice: ShopChoice;
  name: string;
  address: string;
  description: string;
  point?: MapPoint;
  traits: ShopTraits;
  photo?: ShopPhotoSelection & { key?: string; uploadError?: string };
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
    description: "",
    point: choice.place?.point,
    traits: defaultShopTraits(),
    photo: undefined,
    uncertain: false,
  };
}

function sameShop(a: ShopChoice, b: ShopChoice) {
  return a.place || b.place
    ? a.place?.id === b.place?.id
    : manualName(a.keyword) === manualName(b.keyword);
}

export function useNewShop(rememberDraft = false) {
  const { api, user, toast, upload } = useApp();
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
  const photoFile = draft.photo?.file;
  const [photoPreview, setPhotoPreview] = useState<string>();
  const [photoUploadPhase, setPhotoUploadPhase] = useState<
    "uploading" | "confirming"
  >();
  useEffect(() => {
    if (!photoFile || !details) {
      setPhotoPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile, details]);

  function update(patch: Partial<ShopDraft>) {
    const next = { ...currentDraft.current, ...patch };
    currentDraft.current = next;
    if (owner !== undefined) desktopDrafts.set(owner, next);
    setDraft(next);
  }

  useEffect(() => {
    if (details) formRef.current?.focus({ preventScroll: true });
  }, [details]);

  const dirty = !!(
    draft.name ||
    draft.address ||
    draft.description ||
    draft.point ||
    photoFile
  );
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
    codePoints(draft.address.trim()) <= restaurantAddressLimit &&
    codePoints(draft.description.trim()) <= restaurantDescriptionLimit &&
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
      const name = boundedText(draft.name, 20, "店名");
      const address = boundedText(
        draft.address,
        restaurantAddressLimit,
        "地址",
      );
      const point = requireShopLocation(draft.point);
      const photo = draft.photo;
      let picture = photo?.key;
      if (photo && !picture) {
        const editingPhoto = () =>
          active.current &&
          formRef.current &&
          currentDraft.current.photo === photo;
        setPhotoUploadPhase("uploading");
        try {
          picture = await upload(photo.file, "restaurants", (phase) => {
            if (editingPhoto()) setPhotoUploadPhase(phase);
          });
        } catch (error) {
          const message = errorMessage(error);
          if (editingPhoto() && message)
            update({ photo: { ...photo, uploadError: message } });
          throw error;
        } finally {
          if (active.current) setPhotoUploadPhase(undefined);
        }
        if (!editingPhoto()) return;
        update({ photo: { ...photo, key: picture, uploadError: undefined } });
      }
      try {
        const created = await api.createRestaurant({
          name,
          address,
          ...(draft.description.trim()
            ? { description: draft.description.trim() }
            : {}),
          ...point,
          ...(picture ? { pictureUrl: [picture] } : {}),
          hubId: area?.hubId,
          ...draft.traits,
        });
        if (!created.revisionId)
          reportWebUsage({ event: "publish_success", kind: "RESTAURANT" });
        if (owner !== undefined) desktopDrafts.delete(owner);
        if (!active.current) return;
        if (created.revisionId) {
          toast("新店已提交，等待审核。");
          nav("/publish", { replace: true });
          return;
        }
        m.setShopId(created.id);
        m.setDraft({
          restaurantId: created.id,
          shopName: name,
          restaurantPicked: true,
        });
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
    photoPreview,
    setPhoto: (photo?: ShopPhotoSelection) => update({ photo }),
    photoUploadPhase,
    submit,
    busy,
    canSubmit,
    pending: task.isPending,
    formRef,
  };
}
