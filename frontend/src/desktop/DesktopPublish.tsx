import { useFeedbackState } from "../components/feedback";
import { DishAvailabilityFields } from "../features/DishAvailability";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateFoodDraft } from "../api/content-rules";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useApp } from "../app/state";
import { DishDuplicateHint } from "../features/DishDuplicateHint";
import { usePageLifetime } from "../app/drafts";
import { useArea } from "../app/area";
import { duplicateFoodId, errorMessage, resultUncertain } from "../api/client";
import { mediaUrl, money, type Category } from "../api/models";
import { validateFiles } from "../api/validation";
import { DesignIcon as Icon, useMobile } from "../mobile/ui";
import { stageColors } from "../mobile/catalog";
import { adjustPhoto, saveVisual } from "../mobile/photos";
import CropDialog from "./CropDialog";
import "./publish.css";
import { publishDisplay } from "../api/food-display";
import { foodCategories, MAX_DISH_TAGS } from "../api/v2-vocab";
import { AiTagSuggest, draftPictureKeys } from "../features/AiTagSuggest";
import { PublishButton } from "../components/PublishButton";

const kinds = foodCategories;
let submissionInFlight = false;

export default function DesktopPublish() {
  const app = useApp(),
    m = useMobile(),
    { area } = useArea(),
    location = useLocation(),
    nav = useNavigate(),
    cache = useQueryClient();
  const active = usePageLifetime();
  const routeKey = useRef(location.key);
  routeKey.current = location.key;
  const { draft } = m,
    draftRef = useRef(draft);
  draftRef.current = draft;
  const input = useRef<HTMLInputElement>(null),
    searchInput = useRef<HTMLInputElement>(null),
    shopPickerToggle = useRef<HTMLButtonElement>(null),
    photoLock = useRef(false);
  const [shopPickerExpanded, setShopPickerExpanded] = useState(false);
  const [keyword, setKeyword] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const [photo, setPhoto] = useState(0),
    [cropIndex, setCropIndex] = useState<number | null>(null),
    [photoBusy, setPhotoBusy] = useState(false),
    [dragging, setDragging] = useState(false);
  const [duplicate, setDuplicate] = useState<number>(),
    [error, setError] = useFeedbackState(),
    [progress, setProgress] = useState(""),
    [checked, setChecked] = useState(false);
  const selectedId =
      location.pathname !== "/publish" ? m.shopId : draft.restaurantId,
    locked = !!draft.publishing || photoBusy;
  const shops = useQuery({
    queryKey: ["restaurants", "publish", area, search, page],
    queryFn: () =>
      area
        ? app.api.restaurantSearch({
            gcjLng: area!.gcjLng,
            gcjLat: area!.gcjLat,
            hubId: area?.hubId,
            keyword: search || undefined,
            page,
            pageSize: 12,
          })
        : app.api.browseRestaurants({
            keyword: search || undefined,
            page,
            pageSize: 12,
          }),
    placeholderData: keepPreviousData,
  });
  const systemTags = useQuery({
    queryKey: ["system-tags"],
    queryFn: () => app.api.systemTags(),
  });
  const restaurant = useQuery({
    queryKey: ["restaurants", "detail", selectedId],
    queryFn: () => app.api.restaurant(selectedId!),
    enabled: !!selectedId,
  });
  const shop = restaurant.data,
    image = draft.images[photo] ?? draft.images[0];
  const selectedShop =
    shop ?? shops.data?.items?.find((item) => item.id === selectedId);
  const shopPickerOpen = !selectedId || shopPickerExpanded;
  useEffect(() => {
    if (restaurant.isError) setShopPickerExpanded(true);
  }, [restaurant.isError]);
  function toggleShopPicker(open: boolean) {
    setShopPickerExpanded(open);
    requestAnimationFrame(() =>
      (open ? searchInput.current : shopPickerToggle.current)?.focus({
        preventScroll: true,
      }),
    );
  }
  const hasShop = !!shop?.id,
    hasPhoto = !!draft.images.length,
    hasName = !!draft.name.trim(),
    ready = hasShop && hasPhoto && hasName;
  const missing = [
    !hasShop && "选一家店",
    !hasPhoto && "添加照片",
    !hasName && "填写菜名",
  ].filter(Boolean);
  useEffect(() => {
    document.title = "分享一道菜 · 山软今天吃什么";
  }, []);
  useEffect(() => {
    if (location.pathname !== "/publish" && m.shopId)
      m.setDraft({ restaurantId: m.shopId });
  }, [location.pathname]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(keyword.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [keyword]);
  useEffect(() => {
    if (location.pathname === "/publish/crop" && draftRef.current.images.length)
      setCropIndex(0);
  }, [location.pathname]);
  useEffect(() => {
    if (!draft.publishing) return;
    const guard = (event: BeforeUnloadEvent) => {
      if (submissionInFlight) event.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [draft.publishing]);
  function closeCrop() {
    setCropIndex(null);
    if (location.pathname === "/publish/crop")
      nav("/publish/dish", { replace: true });
  }
  async function addFiles(files: File[]) {
    if (!files.length || locked || photoLock.current || draft.publishUncertain)
      return;
    photoLock.current = true;
    setPhotoBusy(true);
    setError("");
    try {
      const current = draftRef.current.images;
      validateFiles(files, current.length);
      const suggested = await adjustPhoto(files[0], { x: 0, y: 0, zoom: 1 });
      const added = files.map((file) => ({
        file,
        original: file,
        url: URL.createObjectURL(file),
      }));
      m.setDraft({
        images: [...current, ...added],
        candidates: suggested.colors,
      });
      setPhoto(current.length);
    } catch (e) {
      setError(errorMessage(e));
      setDuplicate(duplicateFoodId(e));
    } finally {
      photoLock.current = false;
      setPhotoBusy(false);
    }
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (submissionInFlight || locked || draft.publishUncertain || false) return;
    let snapshot = draftRef.current;
    const startedAtRoute = routeKey.current;
    try {
      snapshot = {
        ...snapshot,
        tags: [],
        tagInput: "",
      };
      validateFoodDraft(snapshot);
    } catch (error) {
      setError(errorMessage(error));
      return;
    }
    const price =
      snapshot.price.trim() === "" ? undefined : Number(snapshot.price);
    if (!shop?.id) {
      setError("先在左侧选一家店。");
      toggleShopPicker(true);
      return;
    }
    if (!snapshot.name.trim() || !snapshot.images.length) {
      setError("填写菜名并添加至少一张照片。");
      return;
    }
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
      setError("价格填 0 或更大的数字。");
      return;
    }
    submissionInFlight = true;
    m.setDraft({
      publishing: true,
      publishPhase: snapshot.images.some((image) => !image.key)
        ? "uploading"
        : "submitting",
      tags: snapshot.tags,
      tagInput: "",
    });
    setError("");
    let creating = false;
    try {
      const images = [...snapshot.images];
      const pending = images
        .map((image, index) => ({ image, index }))
        .filter(({ image }) => !image.key);
      if (pending.length)
        await app.uploadMany(
          pending.map(({ image }) => image.file),
          "foods",
          (index, key) => {
            const original = pending[index].index;
            images[original] = { ...images[original], key };
            m.setDraft({ images: [...images] });
            setProgress(`已上传照片 ${index + 1}/${pending.length}`);
          },
        );
      for (let i = 0; i < images.length; i++) {
        saveVisual(images[i].key!, snapshot.stage);
      }
      setProgress("正在发布这道菜…");
      m.setDraft({ publishPhase: "submitting" });
      creating = true;
      const created = await app.api.createFood({
        restaurantId: shop.id,
        name: snapshot.name.trim(),
        price,
        category: snapshot.category as Category,
        description: snapshot.description.trim() || undefined,
        pictureUrl: images.map((item) => item.key!),
        systemTagIds: snapshot.systemTagIds,
        signature: !!snapshot.signature,
        mealTimes: snapshot.mealTimes ?? [],
        deliveryEnabled: !!snapshot.deliveryEnabled,
        ...publishDisplay(snapshot.stage, snapshot.candidates),
        coverCrop: { centerX: 0.5, centerY: 0.5, diameter: 1 },
      });
      for (const item of images)
        if (item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
      m.setDraft({
        name: "",
        price: "",
        category: "staple",
        description: "",
        images: [],
        stage: stageColors[0],
        tags: [],
        tagInput: "",
        systemTagIds: [],
        signature: false,
        mealTimes: [],
        deliveryEnabled: false,
        crop: undefined,
        candidates: undefined,
        shopName: undefined,
        restaurantId: undefined,
        publishUncertain: false,
        publishing: false,
        publishPhase: undefined,
      });
      void cache.invalidateQueries({ queryKey: ["foods"] });
      void cache.invalidateQueries({ queryKey: ["user"] });
      app.refreshMe();
      app.toast(
        created.revisionId
          ? "菜品已提交，等待审核。"
          : "这道菜已发布，快来看看你的分享。",
      );
      m.setFoodId(created.id);
      if (active.current && routeKey.current === startedAtRoute)
        nav(created.revisionId ? "/me/shares" : `/foods/${created.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setDuplicate(duplicateFoodId(e));
      if (creating && resultUncertain(e))
        m.setDraft({ publishUncertain: true });
    } finally {
      submissionInFlight = false;
      m.setDraft({ publishing: false, publishPhase: undefined });
      setProgress("");
    }
  }
  return (
    <div className="pc-composer">
      <header className="pc-composer-heading">
        <div>
          <div className="pc-breadcrumb">
            <Link to="/">发现</Link>
            <Icon name="chevronRight" size={13} />
            <span>分享一道菜</span>
          </div>
          <h1>把这一口，分享出去。</h1>
        </div>
        <span className="pc-composer-draft">
          <i />
          切换页面保留草稿，刷新会清空
        </span>
      </header>
      <div className="pc-composer-layout">
        <aside
          className="pc-composer-shops"
          aria-labelledby="pc-composer-shop-title"
        >
          <div className="pc-composer-section-title">
            <h2 id="pc-composer-shop-title">这道菜来自</h2>
            <span className={`pc-required${shop?.id ? " is-selected" : ""}`}>
              {shop?.id ? "已选择" : "必选"}
            </span>
          </div>
          {selectedId && (
            <div className="pc-composer-selected">
              <span className="pc-composer-shop-photo">
                <Icon name="store" size={21} />
              </span>
              <div className="pc-composer-selected-copy">
                <strong>
                  {selectedShop?.name?.trim() ||
                    draft.shopName?.trim() ||
                    (restaurant.isError ? "餐厅暂时无法读取" : "正在读取餐厅…")}
                </strong>
                {selectedShop?.address && <small>{selectedShop.address}</small>}
              </div>
              <button
                ref={shopPickerToggle}
                type="button"
                className="pc-composer-shop-toggle"
                aria-label={shopPickerOpen ? "收起餐厅列表" : "更换餐厅"}
                aria-expanded={shopPickerOpen}
                aria-controls="pc-composer-shop-picker"
                disabled={locked || draft.publishUncertain}
                onClick={() => toggleShopPicker(!shopPickerOpen)}
              >
                {shopPickerOpen ? "收起" : "更换"}
                <Icon name="chevronDown" size={13} />
              </button>
            </div>
          )}
          <div
            id="pc-composer-shop-picker"
            className="pc-composer-shop-picker"
            data-open={shopPickerOpen}
            aria-hidden={!shopPickerOpen}
            inert={!shopPickerOpen || undefined}
            onKeyDown={(event) => {
              if (event.key === "Escape" && selectedId) {
                event.stopPropagation();
                toggleShopPicker(false);
              }
            }}
          >
            <div className="pc-composer-shop-picker-inner">
              <div className="pc-composer-shop-picker-content">
                <button
                  type="button"
                  className="pc-composer-area"
                  disabled={locked}
                  onClick={() => m.openPanel("G-PanelPlace")}
                >
                  <Icon name="nearby" size={15} />
                  {area?.name ?? "先选择所在区域"}
                  <Icon name="chevronDown" size={14} />
                </button>
                <div className="pc-composer-search">
                  <Icon name="search" size={17} />
                  <input
                    ref={searchInput}
                    aria-label="搜索发布餐厅"
                    placeholder="搜索店名"
                    value={keyword}
                    disabled={locked || draft.publishUncertain}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                  {keyword && (
                    <button
                      type="button"
                      aria-label="清空店名搜索"
                      onClick={() => setKeyword("")}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
                <div
                  className="pc-composer-shop-list"
                  role="radiogroup"
                  aria-label="选择发布餐厅"
                  aria-busy={shops.isFetching}
                >
                  {shops.isPending ? (
                    <ContentSkeleton kind="rows" count={4} />
                  ) : shops.error ? (
                    <div className="pc-composer-list-message" role="alert">
                      {errorMessage(shops.error)}
                      <button
                        type="button"
                        onClick={() => void shops.refetch()}
                      >
                        重新加载
                      </button>
                    </div>
                  ) : (
                    <>
                      {shops.data?.items?.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className="pc-composer-shop"
                          role="radio"
                          aria-checked={selectedId === item.id}
                          disabled={locked || draft.publishUncertain}
                          onClick={() => {
                            m.setShopId(item.id!);
                            m.setDraft({
                              restaurantId: item.id!,
                              shopName: item.name ?? "",
                            });
                            setError("");
                            toggleShopPicker(false);
                          }}
                        >
                          <span className="pc-composer-shop-photo">
                            {mediaUrl(item.pictureUrl?.[0]) ? (
                              <img
                                src={mediaUrl(item.pictureUrl?.[0])}
                                alt=""
                              />
                            ) : (
                              <Icon name="store" size={22} />
                            )}
                          </span>
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.address ?? "地址待补充"}</small>
                          </span>
                          <span className="pc-composer-radio">
                            {selectedId === item.id && (
                              <Icon name="check" size={12} />
                            )}
                          </span>
                        </button>
                      ))}
                      {!shops.data?.items?.length && (
                        <div className="pc-composer-list-message">
                          没有找到这家店，试试其他店名。
                        </div>
                      )}
                      {(page > 1 || shops.data?.hasNext) && (
                        <div className="pc-composer-shop-pages">
                          <button
                            type="button"
                            disabled={page === 1 || locked || shops.isFetching}
                            onClick={() => setPage((p) => p - 1)}
                          >
                            上一页
                          </button>
                          <span>{page}</span>
                          <button
                            type="button"
                            disabled={
                              !shops.data?.hasNext || locked || shops.isFetching
                            }
                            onClick={() => setPage((p) => p + 1)}
                          >
                            下一页
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {restaurant.error && (
                  <div className="pc-composer-list-message" role="alert">
                    {errorMessage(restaurant.error)}
                    <button
                      type="button"
                      onClick={() => void restaurant.refetch()}
                    >
                      重新读取所选餐厅
                    </button>
                  </div>
                )}
                <Link className="pc-composer-new-shop" to="/restaurants/new">
                  <Icon name="add" size={15} />
                  没有找到？添加一家新店
                </Link>
              </div>
            </div>
          </div>
        </aside>
        <form
          className="pc-composer-editor"
          onSubmit={publish}
          aria-label="发布菜品表单"
          aria-busy={!!draft.publishing}
        >
          <fieldset
            className="pc-composer-photo-section"
            disabled={locked || draft.publishUncertain}
          >
            <legend>
              菜品照片 <span>至少 1 张</span>
            </legend>
            <div
              className={`pc-composer-stage ${dragging ? "is-dragging" : ""} ${[stageColors[4], stageColors[5], stageColors[6]].includes(draft.stage) ? "is-dark" : ""}`}
              style={{ background: draft.stage }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!locked) setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void addFiles([...event.dataTransfer.files]);
              }}
            >
              {image ? (
                <img
                  className="pc-composer-cover"
                  src={image.url}
                  alt="当前菜品封面"
                />
              ) : (
                <button
                  type="button"
                  className="pc-composer-empty-photo"
                  onClick={() => input.current?.click()}
                >
                  <Icon name="camera" size={30} />
                  <strong>把好吃的放在这里</strong>
                  <span>拖入照片，或点击添加</span>
                </button>
              )}
              {image && (
                <button
                  type="button"
                  className="pc-composer-crop-button"
                  onClick={() => setCropIndex(photo)}
                >
                  <Icon name="edit" size={15} />
                  调整照片
                </button>
              )}
              <div className="pc-composer-preview-name">
                <span>{draft.name.trim() || "这道菜叫什么？"}</span>
                {draft.price.trim() !== "" &&
                  Number.isFinite(Number(draft.price)) && (
                    <strong>{money(Number(draft.price))}</strong>
                  )}
              </div>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                event.target.value = "";
                void addFiles(files);
              }}
            />
            <div className="pc-composer-thumbnails">
              {draft.images.map((item, i) => (
                <button
                  key={item.url}
                  type="button"
                  aria-label={`选择照片 ${i + 1}`}
                  aria-pressed={photo === i}
                  onClick={() => setPhoto(i)}
                >
                  <img src={item.url} alt="" />
                  {i === 0 && <span>封面</span>}
                </button>
              ))}
              {draft.images.length < 9 && (
                <button
                  type="button"
                  className="pc-composer-add-photo"
                  aria-label="添加菜品照片"
                  onClick={() => input.current?.click()}
                >
                  <Icon name="add" size={23} />
                  <span>{draft.images.length}/9</span>
                </button>
              )}
            </div>
            {image && (
              <div className="pc-composer-photo-actions">
                <button type="button" onClick={() => setCropIndex(photo)}>
                  重新取景
                </button>
                {photo > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const images = [...draft.images],
                        cover = images.splice(photo, 1)[0];
                      m.setDraft({ images: [cover, ...images] });
                      setPhoto(0);
                    }}
                  >
                    设为封面
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (image.url.startsWith("blob:"))
                      URL.revokeObjectURL(image.url);
                    const images = draft.images.filter(
                      (item) => item !== image,
                    );
                    m.setDraft({ images });
                    setPhoto(Math.max(0, Math.min(photo, images.length - 1)));
                  }}
                >
                  移除照片
                </button>
              </div>
            )}
            <p className="pc-composer-photo-help">
              JPG、PNG、WebP，单张不超过 10 MB。第一张照片作为封面。
            </p>
            <div className="pc-composer-palette">
              <div>
                <strong>舞台色</strong>
                <span>让照片和页面更搭</span>
              </div>
              <div role="group" aria-label="选择菜品舞台色">
                {stageColors.map((color, i) => (
                  <button
                    type="button"
                    key={color}
                    style={{ background: color }}
                    aria-label={`舞台色 ${i + 1}`}
                    aria-pressed={draft.stage === color}
                    onClick={() => m.setDraft({ stage: color })}
                  >
                    {draft.stage === color && <Icon name="check" size={13} />}
                  </button>
                ))}
              </div>
              {!!draft.candidates?.length && (
                <small>
                  照片推荐：
                  {draft.candidates.map((color) => (
                    <button
                      type="button"
                      key={color}
                      style={{
                        background: color,
                        color: [
                          stageColors[4],
                          stageColors[5],
                          stageColors[6],
                        ].includes(color)
                          ? "white"
                          : "#231c18",
                      }}
                      aria-label={`推荐颜色 ${color}`}
                      onClick={() => m.setDraft({ stage: color })}
                    />
                  ))}
                </small>
              )}
            </div>
          </fieldset>
          <fieldset
            className="pc-composer-fields"
            disabled={locked || draft.publishUncertain}
          >
            <legend>
              介绍这道菜 <span>让同学更好选择</span>
            </legend>
            <div className="pc-composer-name-price">
              <label>
                菜名 <span className="pc-required">必填</span>
                <input
                  name="name"
                  aria-label="菜名"
                  value={draft.name}
                  required
                  maxLength={24}
                  placeholder="例如：鲜虾蟹籽云吞"
                  onChange={(event) => m.setDraft({ name: event.target.value })}
                />
              </label>
              <label>
                价格 <span>选填</span>
                <div className="pc-composer-price">
                  <span>¥</span>
                  <input
                    name="price"
                    aria-label="价格"
                    type="number"
                    min="0"
                    max="999"
                    step="0.1"
                    placeholder="如 18"
                    value={draft.price}
                    onChange={(event) =>
                      m.setDraft({ price: event.target.value })
                    }
                  />
                </div>
              </label>
            </div>
            <DishDuplicateHint restaurantId={selectedId} name={draft.name} />
            <div className="pc-composer-kind">
              <span>菜品分类</span>
              <div role="radiogroup" aria-label="菜品分类">
                {kinds.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    role="radio"
                    aria-checked={draft.category === item.id}
                    onClick={() => m.setDraft({ category: item.id })}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
            <label className="pc-composer-description">
              说说你的推荐理由 <span>选填</span>
              <textarea
                aria-label="推荐理由"
                placeholder="味道怎么样？分量够不够？有什么值得推荐的吃法？"
                value={draft.description}
                maxLength={600}
                onChange={(event) =>
                  m.setDraft({ description: event.target.value })
                }
              />
            </label>
            <AiTagSuggest
              restaurantId={shop?.id}
              name={draft.name}
              description={draft.description}
              tagOptions={systemTags.data ?? []}
              pictures={() =>
                draftPictureKeys(draft.images, app.uploadMany, (keys) =>
                  m.setDraft({
                    images: draftRef.current.images.map((image) =>
                      !image.key && keys.has(image.file)
                        ? { ...image, key: keys.get(image.file) }
                        : image,
                    ),
                  }),
                )
              }
              current={{
                category: draft.category,
                tagIds: draft.systemTagIds ?? [],
              }}
              disabled={locked || draft.publishUncertain}
              onApply={(category, tagIds) =>
                m.setDraft({
                  ...(category ? { category } : {}),
                  ...(tagIds.length ? { systemTagIds: tagIds } : {}),
                })
              }
            />
            <div className="ew-feature ew-meals">
              <b>招牌菜</b>
              <label>
                <input
                  type="checkbox"
                  checked={!!draft.signature}
                  disabled={locked || draft.publishUncertain}
                  onChange={(e) => m.setDraft({ signature: e.target.checked })}
                />
                这是这家店的招牌
              </label>
            </div>
            <DishAvailabilityFields
              value={{
                mealTimes: draft.mealTimes ?? [],
                deliveryEnabled: !!draft.deliveryEnabled,
              }}
              disabled={locked || draft.publishUncertain}
              onChange={(next) => m.setDraft(next)}
            />
            <div className="ew-feature ew-meals">
              <b>口味标签（最多 {MAX_DISH_TAGS} 个）</b>
              {systemTags.isPending && <small>正在读取公共标签…</small>}
              {!systemTags.isPending &&
                !systemTags.isError &&
                !systemTags.data?.length && (
                  <small className="pc-composer-tags-empty">
                    暂无可选口味标签。
                  </small>
                )}
              {systemTags.data?.map((t) => (
                <label key={t.id}>
                  <input
                    type="checkbox"
                    checked={draft.systemTagIds?.includes(t.id!) ?? false}
                    disabled={
                      !draft.systemTagIds?.includes(t.id!) &&
                      (draft.systemTagIds?.length ?? 0) >= MAX_DISH_TAGS
                    }
                    onChange={(e) =>
                      m.setDraft({
                        systemTagIds: e.target.checked
                          ? [...(draft.systemTagIds ?? []), t.id!]
                          : (draft.systemTagIds ?? []).filter(
                              (id) => id !== t.id,
                            ),
                      })
                    }
                  />
                  {t.name}
                </label>
              ))}
              {systemTags.isError && (
                <button type="button" onClick={() => void systemTags.refetch()}>
                  口味标签加载失败，重试
                </button>
              )}
            </div>
            <div className="pc-composer-recap">
              <span>本次分享</span>
              <strong>{shop?.name ?? "选择一家店"}</strong>
              <small>
                {draft.name.trim() || "填写菜名"} ·{" "}
                {kinds.find((item) => item.id === draft.category)?.name ??
                  "主食"}{" "}
                · {draft.images.length} 张照片
              </small>
            </div>
          </fieldset>
          <footer className="pc-composer-submit">
            <div className="pc-composer-checks" aria-live="polite">
              {[
                { name: "餐厅", done: hasShop },
                { name: "照片", done: hasPhoto },
                { name: "菜名", done: hasName },
              ].map((item) => (
                <span key={item.name} data-done={item.done}>
                  <Icon name={item.done ? "check" : "add"} size={13} />
                  {item.name}
                </span>
              ))}
              <small>
                {draft.publishing
                  ? progress
                  : ready
                    ? "可以发布"
                    : `还需${missing.join("、")}`}
              </small>
            </div>
            <div>
              <button
                type="button"
                className="pc-composer-save"
                disabled={locked}
                onClick={() => {
                  app.toast("草稿已暂存，可从发布入口继续；刷新页面会清空。");
                  nav("/");
                }}
              >
                暂存并离开
              </button>
              <PublishButton
                type="submit"
                className="pc-button"
                disabled={!ready || locked || draft.publishUncertain}
                label="发布这道菜"
                pending={!!draft.publishing}
                phase={draft.publishPhase}
              >
                <Icon name="chevronRight" size={18} />
              </PublishButton>
            </div>
          </footer>
          {(duplicate || draft.publishUncertain) && (
            <div className="pc-composer-error" role="alert">
              {duplicate && (
                <Link to={`/foods/${duplicate}`}>
                  查看已有菜品 →（当前草稿已保留）
                </Link>
              )}
              {draft.publishUncertain && (
                <>
                  <strong>发布结果尚未确认，请先核实，避免重复分享。</strong>
                  <Link to="/me/shares">查看我的分享</Link>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => setChecked(event.target.checked)}
                    />
                    已确认这道菜尚未发布
                  </label>
                  <button
                    type="button"
                    disabled={!checked}
                    onClick={() => {
                      m.setDraft({ publishUncertain: false });
                      setError("");
                      setChecked(false);
                    }}
                  >
                    继续编辑
                  </button>
                </>
              )}
            </div>
          )}
        </form>
      </div>
      {cropIndex !== null && draft.images[cropIndex] && (
        <CropDialog
          image={draft.images[cropIndex]}
          onClose={closeCrop}
          onApply={(result, framing) => {
            const images = [...draftRef.current.images],
              old = images[cropIndex];
            if (!old) return;
            images[cropIndex] = {
              file: result.file,
              original: old.original ?? old.file,
              url: URL.createObjectURL(result.file),
              framing,
            };
            if (old.url.startsWith("blob:")) URL.revokeObjectURL(old.url);
            m.setDraft({ images, candidates: result.colors });
            closeCrop();
            app.toast("照片已调整，继续完善这道菜吧。");
          }}
        />
      )}
    </div>
  );
}
