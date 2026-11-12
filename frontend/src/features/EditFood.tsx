import { useFeedbackState } from "../components/feedback";
import { Select } from "../components/Select";
import { foodEditBody, submissionPath } from "../api/content-rules";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { LoginLink } from "../app/auth-dialog";
import { useReturnTo } from "../app/navigation";
import {
  categories,
  mediaUrl,
  parseId,
  type Food,
  type Schema,
} from "../api/models";
import { duplicateFoodId, errorMessage, resultUncertain } from "../api/client";
import { FoodPhotoPicker, type EditableFoodPhoto } from "./FoodPhotoPicker";
import { MAX_DISH_TAGS, tasteTags, type V2Food } from "../api/v2-vocab";
import { isDemo } from "../app/runtime";
import {
  useMemoryDraft,
  usePageLifetime,
  useSessionDraft,
} from "../app/drafts";
import { FeaturePage, FeatureState } from "./Catalog";
import "./latest.css";

export function EditFood() {
  const { api, session, user } = useApp(),
    loc = useLocation(),
    id = parseId(loc.pathname.match(/^\/foods\/(\d+)\/edit$/)?.[1]),
    q = useQuery({
      queryKey: ["foods", "detail", id],
      queryFn: () => api.food(id!),
      enabled: !!id && !!session,
    });
  const detailPath = id ? `/foods/${id}` : "/me";
  const origin = useReturnTo(detailPath);
  const originPath = origin.split("?")[0];
  const back =
    originPath === detailPath ||
    ["/me", "/favorites", "/search", "/history"].includes(originPath)
      ? origin
      : detailPath;
  const detailReturn = originPath === detailPath ? origin : detailPath;
  if (!session)
    return (
      <FeaturePage title="编辑菜品">
        <LoginLink
          className="ew-button"
          to={"/auth/password?next=" + encodeURIComponent(loc.pathname)}
        >
          登录后编辑
        </LoginLink>
      </FeaturePage>
    );
  if (!user?.verified || user.banned)
    return (
      <FeaturePage title="编辑菜品">
        <FeatureState empty="完成学生认证后，可管理自己的菜品" />
        <Link className="ew-button" to="/verify">
          查看认证状态
        </Link>
      </FeaturePage>
    );
  if (!id)
    return (
      <FeaturePage title="编辑菜品">
        <FeatureState empty="菜品编号无效" />
      </FeaturePage>
    );
  return (
    <FeaturePage title="编辑这道菜" back={back}>
      {q.isPending || q.isError ? (
        <FeatureState
          loading={q.isPending}
          error={q.error}
          retry={() => void q.refetch()}
        />
      ) : q.data.accountId !== user.id ? (
        <FeatureState empty="只能编辑你自己分享的菜品" />
      ) : (
        <EditForm
          key={id}
          food={q.data}
          back={back}
          detailReturn={detailReturn}
        />
      )}
    </FeaturePage>
  );
}
function EditForm({
  food,
  back,
  detailReturn,
}: {
  food: Food;
  back: string;
  detailReturn: string;
}) {
  const { api, uploadMany, toast, user } = useApp(),
    nav = useNavigate(),
    cache = useQueryClient(),
    locked = useRef(false),
    [duplicate, setDuplicate] = useState<number>(),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useFeedbackState();
  const active = usePageLifetime();
  const draftKey = `food:${user?.id}:${food.id}:v2`;
  const originalTags = ((food as Food & V2Food).tags ?? []).filter((t) =>
      tasteTags.includes(t),
    ),
    originalSignature = !!(food as Food & V2Food).signature;
  const [fields, setFields, clearFields] = useSessionDraft(draftKey, {
    name: food.name ?? "",
    description: food.description ?? "",
    price: food.price == null ? "" : String(food.price),
    category: food.category ?? null,
    tags: originalTags,
    signature: originalSignature,
    editVersion: 1,
  });
  const { name, description, price, category, tags, signature } = fields;
  const updateFields = (patch: Partial<typeof fields>) =>
    setFields((f) => ({ ...f, ...patch }));
  const setName = (name: string) => updateFields({ name });
  const setDescription = (description: string) => updateFields({ description });
  const setPrice = (price: string) => updateFields({ price });
  const setCategory = (category: typeof fields.category) =>
    updateFields({ category });
  const [photoDraft, setPhotoDraft, clearPhotos] = useMemoryDraft<{
    photos: EditableFoodPhoto[];
    changed: boolean;
  }>(draftKey, {
    photos:
      food.pictureUrl?.map((url, i) => ({
        url: mediaUrl(url) ?? "",
        key: food.pictureKeys?.[i],
      })) ?? [],
    changed: false,
  });
  const { photos, changed: photosChanged } = photoDraft;
  const setPhotos = (photos: typeof photoDraft.photos) =>
    setPhotoDraft((p) => ({ ...p, photos }));
  const tagsChanged =
    tags.length !== originalTags.length ||
    tags.some((tag) => !originalTags.includes(tag));
  const signatureChanged = signature !== originalSignature;
  const dirty =
    name !== food.name ||
    description !== (food.description ?? "") ||
    price !== (food.price == null ? "" : String(food.price)) ||
    category !== (food.category ?? null) ||
    tagsChanged ||
    signatureChanged ||
    photosChanged;
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  return (
    <form
      className="ew-edit-form ew-form-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        if (locked.current || uncertain) return;
        locked.current = true;
        setBusy(true);
        setError("");
        try {
          if (!name.trim()) throw new Error("请填写菜名。");
          if (food.price != null && price === "")
            throw new Error("价格不能为空，请填写有效价格。");
          const body: Schema["EditFoodDTORequest"] & {
            systemTagIds?: number[];
            signature?: boolean;
          } = {
            name: name.trim(),
            description:
              description !== (food.description ?? "")
                ? description
                : undefined,
            category:
              category && category !== food.category ? category : undefined,
            price: price === "" ? undefined : Number(price),
            systemTagIds: tagsChanged
              ? tags.map((tag) => tasteTags.indexOf(tag) + 1)
              : undefined,
            signature: signatureChanged ? signature : undefined,
          };
          if (photosChanged) {
            if (!photos.length) throw new Error("至少保留一张照片。");
            const next = [...photos];
            const pending = next
              .map((photo, index) => ({ photo, index }))
              .filter(({ photo }) => photo.file && !photo.key);
            if (pending.length)
              await uploadMany(
                pending.map(({ photo }) => photo.file!),
                "foods",
                (index, key) => {
                  const original = pending[index].index;
                  next[original] = { ...next[original], key };
                  setPhotos([...next]);
                },
              );
            for (let i = 0; i < next.length; i++) {
              if (
                !next[i].key ||
                (!isDemo && !next[i].key!.startsWith("foods/"))
              )
                throw new Error(
                  "历史图片暂时不能直接改写，请保留原图片，或移除后重新上传替换。",
                );
            }
            body.pictureUrl = next.map((p) => p.key!);
            // Adding or removing secondary photos must not recrop the cover.
            if (next[0].key !== food.pictureKeys?.[0])
              body.coverCrop = { centerX: 0.5, centerY: 0.5, diameter: 1 };
          }
          const result = await api.editMyFood(
            food.id!,
            foodEditBody(food, body),
          );
          clearFields();
          clearPhotos();
          photos.forEach((p) => {
            if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
          });
          await cache.invalidateQueries({ queryKey: ["foods"] });
          toast(
            result?.revisionId ? "修改已提交，请查看审核进度。" : "菜品已更新",
          );
          if (active.current) nav(submissionPath(result ?? {}, detailReturn));
        } catch (err) {
          setError(errorMessage(err));
          setDuplicate(duplicateFoodId(err));
          if (resultUncertain(err)) setUncertain(true);
        } finally {
          locked.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy || uncertain}>
        <div className="ew-edit-columns">
          <section>
            <FoodPhotoPicker
              photos={photos}
              disabled={busy || uncertain}
              onAdd={(files) => {
                if (locked.current || uncertain) return;
                setPhotoDraft((current) => ({
                  photos: [
                    ...current.photos,
                    ...files.map((file) => ({
                      url: URL.createObjectURL(file),
                      file,
                    })),
                  ],
                  changed: true,
                }));
                setError("");
              }}
              onRemove={(index) => {
                if (locked.current || uncertain) return;
                const removed = photos[index];
                if (removed?.url.startsWith("blob:"))
                  URL.revokeObjectURL(removed.url);
                setPhotoDraft((current) => ({
                  photos: current.photos.filter((_, i) => i !== index),
                  changed: true,
                }));
              }}
            />
          </section>
          <section>
            <label>
              菜品名称
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <div className="ew-field-pair">
              <label>
                价格
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="选填"
                />
              </label>
              <label>
                分类
                <Select
                  value={category ?? ""}
                  onChange={(e) =>
                    setCategory((e.target.value as typeof category) || null)
                  }
                >
                  {!food.category && <option value="">未设置</option>}
                  {categories
                    .filter((c) => c.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                </Select>
              </label>
            </div>
            <label>
              推荐理由
              <textarea
                value={description}
                rows={5}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="ew-meals">
              <b>口味标签（最多 {MAX_DISH_TAGS} 个）</b>
              {tasteTags.map((tag) => (
                <label key={tag}>
                  <input
                    type="checkbox"
                    checked={tags.includes(tag)}
                    disabled={
                      !tags.includes(tag) && tags.length >= MAX_DISH_TAGS
                    }
                    onChange={(e) =>
                      updateFields({
                        tags: e.target.checked
                          ? [...tags, tag]
                          : tags.filter((x) => x !== tag),
                      })
                    }
                  />
                  {tag}
                </label>
              ))}
            </div>
            <div className="ew-meals">
              <b>招牌菜</b>
              <label>
                <input
                  type="checkbox"
                  checked={signature}
                  onChange={(e) =>
                    updateFields({ signature: e.target.checked })
                  }
                />
                这是这家店的招牌
              </label>
            </div>
          </section>
        </div>
      </fieldset>
      {duplicate && (
        <Link to={`/foods/${duplicate}`}>查看已有菜品（当前修改仍保留） →</Link>
      )}
      {uncertain && (
        <p className="ew-error">保存结果尚未确认，请返回详情核实后再继续。</p>
      )}
      <footer className="ew-inline">
        <Link to={back}>
          {back.split("?")[0] === `/foods/${food.id}`
            ? "返回菜品详情"
            : "返回列表"}
        </Link>
        <button className="ew-button" disabled={busy || uncertain || !dirty}>
          {busy ? "正在保存…" : "保存菜品修改"}
        </button>
      </footer>
    </form>
  );
}
