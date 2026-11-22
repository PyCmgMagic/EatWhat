import { useFeedbackState } from "../components/feedback";
import { stageSurface } from "../mobile/catalog";
import {
  DishAvailabilityFields,
  MobileDishOptions,
  dishAvailabilityOf,
  sameMealTimes,
} from "./DishAvailability";
import type { DishServing } from "../api/service";
import { Select } from "../components/Select";
import { foodEditBody } from "../api/content-rules";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { LoginLink } from "../app/auth-dialog";
import { useReturnTo } from "../app/navigation";
import {
  categories,
  mediaUrl,
  parseId,
  type Category,
  type Food,
  type Schema,
} from "../api/models";
import { duplicateFoodId, errorMessage, resultUncertain } from "../api/client";
import { validateFiles } from "../api/validation";
import { FoodPhotoPicker, type EditableFoodPhoto } from "./FoodPhotoPicker";
import {
  foodCategories,
  MAX_DISH_TAGS,
  tasteTags,
  type V2Food,
} from "../api/v2-vocab";
import { stagePalette, publishDisplay, stageNames, type Stage } from "../api/food-display";
import { isDemo } from "../app/runtime";
import {
  useMemoryDraft,
  usePageLifetime,
  useSessionDraft,
} from "../app/drafts";
import { Modal } from "../components/ui";
import DishPhotoPicker from "../mobile/DishPhotoPicker";
import { DesignIcon as Icon } from "../mobile/ui";
import "../mobile/tag-panel.css";
import { FeaturePage, FeatureState } from "./Catalog";
import "./latest.css";
import "./edit-food.css";
import { AiTagSuggest, draftPictureKeys } from "./AiTagSuggest";

const DARK_STAGES = new Set<string>(["#C9442B", "#A8321C", "#8F5B24"]);

export function EditFood({ mobile = false }: { mobile?: boolean }) {
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
    ["/me", "/favorites", "/likes", "/search", "/history"].includes(originPath)
      ? origin
      : detailPath;
  const detailReturn = originPath === detailPath ? origin : detailPath;
  const wrapState = (node: ReactNode) =>
    mobile ? <div className="ew-mobile-feature">{node}</div> : node;
  if (!session)
    return wrapState(
      <FeaturePage title="编辑菜品">
        <LoginLink
          className="ew-button"
          to={"/auth/password?next=" + encodeURIComponent(loc.pathname)}
        >
          登录后编辑
        </LoginLink>
      </FeaturePage>,
    );
  if (!user?.verified || user.banned)
    return wrapState(
      <FeaturePage title="编辑菜品">
        <FeatureState empty="完成学生认证后，可以修改菜品" />
        <Link className="ew-button" to="/verify">
          查看认证状态
        </Link>
      </FeaturePage>,
    );
  if (!id)
    return wrapState(
      <FeaturePage title="编辑菜品">
        <FeatureState empty="菜品编号无效" />
      </FeaturePage>,
    );
  if (q.isPending || q.isError)
    return wrapState(
      <FeaturePage title="编辑这道菜" back={back}>
        <FeatureState
          loading={q.isPending}
          error={q.error}
          retry={() => void q.refetch()}
        />
      </FeaturePage>,
    );
  if (mobile)
    return (
      <EditForm
        key={id}
        food={q.data}
        back={back}
        detailReturn={detailReturn}
        mobile
      />
    );
  return (
    <FeaturePage title="编辑这道菜" back={back}>
      <EditForm
        key={id}
        food={q.data}
        back={back}
        detailReturn={detailReturn}
      />
    </FeaturePage>
  );
}
function EditForm({
  food,
  back,
  detailReturn,
  mobile = false,
}: {
  food: Food;
  back: string;
  detailReturn: string;
  mobile?: boolean;
}) {
  const { api, uploadMany, toast, user } = useApp(),
    nav = useNavigate(),
    cache = useQueryClient(),
    locked = useRef(false),
    mobileFiles = useRef<HTMLInputElement>(null),
    nameId = useId(),
    [duplicate, setDuplicate] = useState<number>(),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [previewPhoto, setPreviewPhoto] = useState<number | null>(null),
    [error, setError] = useFeedbackState();
  const active = usePageLifetime();
  const draftKey = `food:${user?.id}:${food.id}:v2s`;
  const originalTags = ((food as Food & V2Food).tags ?? []).filter((t) =>
      tasteTags.includes(t),
    ),
    originalSignature = !!(food as Food & V2Food).signature,
    originalServing = dishAvailabilityOf(food as Food & V2Food);
  const [fields, setFields, clearFields] = useSessionDraft(draftKey, {
    name: food.name ?? "",
    description: food.description ?? "",
    price: food.price == null ? "" : String(food.price),
    category: food.category ?? null,
    tags: originalTags,
    signature: originalSignature,
    serving: originalServing,
    stage: (food.stageColor ?? null) as Stage | null,
    editVersion: 1,
  });
  const { name, description, price, category, tags, signature, stage } = fields;
  // Drafts saved before this field existed have no serving.
  const serving = fields.serving ?? originalServing;
  const mealTimesChanged = !sameMealTimes(
      serving.mealTimes,
      originalServing.mealTimes,
    ),
    deliveryChanged =
      serving.deliveryEnabled !== originalServing.deliveryEnabled;
  const stageChanged = stage !== (food.stageColor ?? null);
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
    mealTimesChanged ||
    deliveryChanged ||
    stageChanged ||
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
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked.current || uncertain) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      if (!name.trim()) throw new Error("请填写菜名。");
      if (food.price != null && price === "")
        throw new Error("价格不能为空，请填写有效价格。");
      const body: Omit<Schema["EditFoodDTORequest"], "mealTimes"> & {
        systemTagIds?: number[];
        signature?: boolean;
      } & DishServing = {
        name: name.trim(),
        description:
          description !== (food.description ?? "") ? description : undefined,
        category:
          category && category !== food.category ? category : undefined,
        price: price === "" ? undefined : Number(price),
        systemTagIds: tagsChanged
          ? tags.map((tag) => tasteTags.indexOf(tag) + 1)
          : undefined,
        signature: signatureChanged ? signature : undefined,
        mealTimes: mealTimesChanged ? serving.mealTimes : undefined,
        deliveryEnabled: deliveryChanged
          ? serving.deliveryEnabled
          : undefined,
      };
      // v2 saves the stage colour together with its two alternates.
      if (stageChanged && stage) {
        const palette = publishDisplay(
          stagePalette[stage],
          food.stageAlternates?.map((x) => stagePalette[x]),
        );
        body.stageColor = palette.stageColor;
        body.stageAlternates = palette.stageAlternates;
      }
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
      const result = await api.editMyFood(food.id!, foodEditBody(food, body));
      if (body.pictureUrl && result?.pictureKeys) {
        const urlsByKey = new Map(food.pictureKeys?.map((key, index) => [key, food.pictureUrl?.[index]]));
        const pictureKeys = result.pictureKeys;
        const urls = pictureKeys.map((key) => urlsByKey.get(key) || mediaUrl(key));
        if (urls.every((url): url is string => !!url)) {
          cache.setQueryData<Food>(["foods", "detail", food.id], (previous) => previous && ({
            ...previous, pictureKeys, pictureUrl: urls, coverCrop: body.coverCrop ?? previous.coverCrop,
          }));
        }
      }
      clearFields();
      clearPhotos();
      photos.forEach((p) => {
        if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
      });
      await cache.invalidateQueries({ queryKey: ["foods"] });
      // Backend v2 publishes edits at once (the revision id is only the
      // edit-history entry), so go back to the dish.
      toast("菜品已更新");
      if (active.current) nav(detailReturn);
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      if (mobile) toast(msg, { tone: "error" });
      setDuplicate(duplicateFoodId(err));
      if (resultUncertain(err)) setUncertain(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const addFiles = (files: File[]) => {
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
  };
  const removePhoto = (index: number) => {
    if (locked.current || uncertain) return;
    const removed = photos[index];
    if (removed?.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
    setPhotoDraft((current) => ({
      photos: current.photos.filter((_, i) => i !== index),
      changed: true,
    }));
  };
  const movePhoto = (source: string, target: string) => {
    if (locked.current || uncertain) return;
    setPhotoDraft((current) => {
      const next = [...current.photos];
      const from = next.findIndex((item) => item.url === source);
      const to = next.findIndex((item) => item.url === target);
      if (from < 0 || to < 0 || from === to) return current;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { photos: next, changed: true };
    });
  };
  const aiPictures = () =>
    draftPictureKeys(photos, uploadMany, (keys) =>
      setPhotoDraft((d) => ({
        ...d,
        photos: d.photos.map((photo) =>
          !photo.key && photo.file && keys.has(photo.file)
            ? { ...photo, key: keys.get(photo.file) }
            : photo,
        ),
      })),
    );
  const aiCurrent = {
    category,
    tagIds: tags.map((tag) => tasteTags.indexOf(tag) + 1),
  };
  const aiOptions = tasteTags.map((tag, i) => ({ id: i + 1, name: tag }));
  const applyAi = (next: Category | undefined, tagIds: number[]) =>
    updateFields({
      ...(next ? { category: next } : {}),
      ...(tagIds.length
        ? { tags: tagIds.map((id) => tasteTags[id - 1]) }
        : {}),
    });

  if (mobile) {
    const activeStage = stagePalette[stage ?? "broth"];
    const darkStage = DARK_STAGES.has(activeStage);
    const cover = photos[0];
    const toggleTaste = (tag: string) =>
      updateFields({
        tags: tags.includes(tag)
          ? tags.filter((x) => x !== tag)
          : tags.length < MAX_DISH_TAGS
            ? [...tags, tag]
            : tags,
      });
    return (
      <form className="mobile-edit-dish" onSubmit={handleSubmit}>
        <div
          className={`mobile-edit-stage${darkStage ? " is-dark" : ""}`}
          style={{ background: stageSurface(activeStage) }}
        >
          {cover ? (
            <img
              className="mobile-edit-cover"
              src={cover.url}
              alt={name || "菜品封面"}
            />
          ) : (
            <button
              type="button"
              className="mobile-edit-cover is-empty"
              disabled={busy || uncertain}
              onClick={() => mobileFiles.current?.click()}
            >
              <Icon name="camera" size={28} />
              加一张照片
            </button>
          )}
          <header className="mobile-edit-topbar">
            <Link to={back} aria-label="返回">
              <Icon name="back" size={24} />
            </Link>
            <h1>编辑菜品</h1>
            <span aria-hidden="true" />
          </header>
          <div className="mobile-edit-stage-picker">
            <span>舞台色</span>
            <div role="radiogroup" aria-label="舞台色">
              {(Object.entries(stagePalette) as [Stage, string][]).map(
                ([key, color]) => {
                  const selected = stage === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={stageNames[key]}
                      title={stageNames[key]}
                      disabled={busy || uncertain}
                      className={selected ? "is-selected" : undefined}
                      style={{ background: color }}
                      onClick={() => updateFields({ stage: key })}
                    />
                  );
                },
              )}
            </div>
          </div>
        </div>

        <fieldset
          className="mobile-edit-sheet"
          disabled={busy || uncertain}
        >
          <span className="mobile-edit-handle" aria-hidden="true" />
          <div className="mobile-publish-destination">
            <div className="mobile-publish-destination-label">
              <span>所属店铺</span>
              <div>
                <strong>{food.restaurantName || "所属餐厅"}</strong>
              </div>
            </div>
            {food.restaurantId && (
              <Link to={`/restaurants/${food.restaurantId}`}>查看店铺</Link>
            )}
          </div>

          <div className="mobile-edit-headline">
            <div className="mobile-edit-name-col">
              <div className="mobile-publish-name-heading">
                <label htmlFor={nameId}>菜名</label>
                <AiTagSuggest
                  compact
                  className="mobile-publish-ai"
                  foodId={food.id ?? undefined}
                  restaurantId={food.restaurantId}
                  name={name}
                  description={description}
                  tagOptions={aiOptions}
                  pictures={aiPictures}
                  current={aiCurrent}
                  disabled={busy || uncertain}
                  onApply={applyAi}
                />
              </div>
              <input
                id={nameId}
                className="mobile-edit-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="菜品名称"
                maxLength={64}
                required
              />
            </div>
            <label className="mobile-edit-price-col">
              <span>价格</span>
              <span className="mobile-edit-price-box">
                <span>¥</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="选填"
                />
              </span>
            </label>
          </div>

          <input
            ref={mobileFiles}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = "";
              if (!files.length) return;
              try {
                validateFiles(files, photos.length);
                addFiles(files);
              } catch (err) {
                const msg = errorMessage(err);
                setError(msg);
                toast(msg, { tone: "error" });
              }
            }}
          />
          <DishPhotoPicker
            images={photos}
            disabled={busy || uncertain}
            onAdd={() => mobileFiles.current?.click()}
            onEdit={(index) => setPreviewPhoto(index)}
            onMove={movePhoto}
            onRemove={removePhoto}
          />

          <label className="mobile-edit-desc">
            <span>
              推荐理由
              <small>{description.length} 字</small>
            </span>
            <textarea
              value={description}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="说说这道菜的味道、分量或点单建议（选填）"
            />
          </label>

          <fieldset className="mobile-edit-cats">
            <legend>分类</legend>
            <div role="radiogroup" aria-label="分类">
              {foodCategories.map((c) => {
                const on = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mobile-publish-tag-groups">
            <fieldset className="mobile-publish-tags">
              <legend>口味，最多 {MAX_DISH_TAGS} 个，可选</legend>
              <div>
                {tasteTags.map((tag) => {
                  const on = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={on}
                      disabled={!on && tags.length >= MAX_DISH_TAGS}
                      onClick={() => toggleTaste(tag)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <MobileDishOptions
              signature={signature}
              onSignatureChange={(signature) => updateFields({ signature })}
              shopMeals={
                originalServing.mealTimes.length
                  ? undefined
                  : (food as Food & V2Food).effectiveMealTimes
              }
              value={serving}
              disabled={busy || uncertain}
              onChange={(serving) => updateFields({ serving })}
            />
          </div>

          {error && (
            <p className="ew-error mobile-edit-error" role="alert">
              {error}
            </p>
          )}
          {duplicate && (
            <Link className="mobile-edit-duplicate" to={`/foods/${duplicate}`}>
              查看已有菜品（当前修改仍保留） →
            </Link>
          )}
          {uncertain && (
            <p className="ew-error mobile-edit-error" role="alert">
              保存结果尚未确认，请返回详情核实后再继续。
            </p>
          )}
        </fieldset>

        <footer className="mobile-edit-bar">
          <button
            type="submit"
            disabled={busy || uncertain || !dirty}
          >
            {busy ? "正在保存…" : "保存修改"}
          </button>
        </footer>

        {previewPhoto !== null && photos[previewPhoto] && (
          <Modal
            title={`第 ${previewPhoto + 1} 张照片${previewPhoto === 0 ? "（封面）" : ""}`}
            onClose={() => setPreviewPhoto(null)}
          >
            <div className="food-photo-modal">
              <img
                src={photos[previewPhoto].url}
                alt={`菜品照片 ${previewPhoto + 1}`}
              />
            </div>
          </Modal>
        )}
      </form>
    );
  }

  return (
    <form className="ew-edit ew-edit-form" onSubmit={handleSubmit}>
      <fieldset disabled={busy || uncertain}>
        <div className="ew-edit-columns">
          <section className="ew-edit-col">
            <div className="ew-edit-card" data-card="photos">
              <FoodPhotoPicker
                photos={photos}
                disabled={busy || uncertain}
                onAdd={addFiles}
                onRemove={removePhoto}
                onMove={movePhoto}
              />
            <label>
              舞台色
              <Select
                value={stage ?? ""}
                onChange={(e) =>
                  updateFields({ stage: (e.target.value as Stage) || null })
                }
              >
                {!food.stageColor && <option value="">分类默认色</option>}
                {Object.entries(stagePalette).map(([key, color]) => (
                  <option key={key} value={key} data-color={color}>
                    {stageNames[key as Stage]}
                  </option>
                ))}
              </Select>
            </label>
            </div>
            <div className="ew-edit-card" data-card="menu">
              <header className="ew-edit-head">
                <h2>菜单属性</h2>
              </header>
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
              <DishAvailabilityFields
                value={serving}
                disabled={busy || uncertain}
                onChange={(serving) => updateFields({ serving })}
              />
            </div>
          </section>
          <section className="ew-edit-col">
            <div className="ew-edit-card" data-card="basic">
              <header className="ew-edit-head">
                <h2>基本信息</h2>
              </header>
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
            </div>
            <div className="ew-edit-card" data-card="tags">
              <header className="ew-edit-head">
                <h2>口味与标签</h2>
              </header>
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
            <AiTagSuggest
              className="ew-meals ew-ai-suggest"
              foodId={food.id ?? undefined}
              restaurantId={food.restaurantId}
              name={name}
              description={description}
              tagOptions={aiOptions}
              pictures={aiPictures}
              current={aiCurrent}
              disabled={busy || uncertain}
              onApply={applyAi}
            />
            </div>
          </section>
        </div>
      </fieldset>
      {error && (
        <p className="ew-error" role="alert">
          {error}
        </p>
      )}
      {duplicate && (
        <Link to={`/foods/${duplicate}`}>查看已有菜品（当前修改仍保留） →</Link>
      )}
      {uncertain && (
        <p className="ew-error">保存结果尚未确认，请返回详情核实后再继续。</p>
      )}
      <footer className="ew-edit-footer">
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
