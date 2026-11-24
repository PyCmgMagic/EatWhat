import { reportWebUsage } from "../app/web-usage";
import { BRAND_NAME } from "../app/brand";
import { useFeedbackState } from "../components/feedback";
import { DishAvailabilityFields } from "../features/DishAvailability";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { codePoints, foodDescriptionLimit, validateFoodDraft } from "../api/content-rules";
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
import { recommendPhotoStage, saveVisual } from "../mobile/photos";
import { applyPhotoEdit, draftStage } from "../mobile/draft-photo-edit";
import CropDialog from "./CropDialog";
import PublishPhotoThumbnails from "./PublishPhotoThumbnails";
import "./publish.css";
import { publishDisplay, stageCode, stageNames } from "../api/food-display";
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
  const [previewUrl, setPreviewUrl] = useState<string>(),
    [cropUrl, setCropUrl] = useState<string>(),
    [showAllColors, setShowAllColors] = useState(false),
    [dragging, setDragging] = useState(false);
  const [duplicate, setDuplicate] = useState<number>(),
    [error, setError] = useFeedbackState(),
    [progress, setProgress] = useState(""),
    [checked, setChecked] = useState(false);
  const selectedId =
      location.pathname !== "/publish" ? m.shopId : draft.restaurantId,
    photoBusy = draft.images.some((photo) => photo.preparing),
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
  const shop = restaurant.data;
  const image =
    draft.images.find(({ url }) => url === previewUrl) ?? draft.images[0];
  const photoIndex = draft.images.indexOf(image);
  const cropImage = draft.images.find(({ url }) => url === cropUrl);
  const stage = draftStage(draft);
  const candidates = draft.images[0]?.stageCandidates ?? [];
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
    !hasShop && "选择餐厅",
    !hasPhoto && "添加照片",
    !hasName && "填写菜名",
  ].filter(Boolean);
  useEffect(() => {
    document.title = `分享一道菜 · ${BRAND_NAME}`;
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
    if (location.pathname === "/publish/crop")
      setCropUrl(draftRef.current.images[0]?.url);
  }, [location.pathname]);
  function closeCrop() {
    setCropUrl(undefined);
    if (location.pathname === "/publish/crop")
      nav("/publish/dish", { replace: true });
  }
  async function addFiles(files: File[]) {
    if (!files.length || locked || photoLock.current || draft.publishUncertain)
      return;
    photoLock.current = true;
    setError("");
    try {
      const current = draftRef.current.images;
      validateFiles(files, current.length);
      const added = files.map((file) => ({
        file,
        original: file,
        url: URL.createObjectURL(file),
        preparing: true,
      }));
      m.setDraft((d) => ({ images: [...d.images, ...added] }));
      setPreviewUrl(added[0].url);
      for (const photo of added) {
        try {
          const stageCandidates = await recommendPhotoStage(photo.file);
          m.setDraft((d) => ({
            images: d.images.map((item) =>
              item.url === photo.url
                ? { ...item, stageCandidates, preparing: false }
                : item,
            ),
          }));
        } catch {
          m.setDraft((d) => {
            if (!d.images.some((item) => item.url === photo.url)) return {};
            const images = d.images.filter((item) => item.url !== photo.url);
            return { images, stage: images.length ? d.stage : undefined };
          });
          URL.revokeObjectURL(photo.url);
          if (active.current)
            setError(`无法读取「${photo.file.name}」，请重新选择照片。`);
        }
      }
    } catch (e) {
      setError(errorMessage(e));
      setDuplicate(duplicateFoodId(e));
    } finally {
      photoLock.current = false;
    }
  }
  function movePhoto(source: string, target: string) {
    const current = draftRef.current.images;
    const from = current.findIndex(({ url }) => url === source);
    const to = current.findIndex(({ url }) => url === target);
    if (from === -1 || to === -1 || from === to) return;
    const images = [...current];
    const [moved] = images.splice(from, 1);
    images.splice(to, 0, moved);
    m.setDraft({ images });
    if (images[0] !== current[0]) setPreviewUrl(images[0].url);
  }
  function removePhoto(url: string) {
    const current = draftRef.current;
    const index = current.images.findIndex((item) => item.url === url);
    if (index === -1) return;
    const images = current.images.filter((item) => item.url !== url);
    m.setDraft({ images, stage: images.length ? current.stage : undefined });
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    if (!images.length) setShowAllColors(false);
    if (index === 0 || image?.url === url)
      setPreviewUrl(images[Math.min(index, images.length - 1)]?.url);
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (submissionInFlight || locked || draft.publishUncertain) return;
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
    const stage = draftStage(snapshot);
    if (!shop?.id) {
      setError("请先选择餐厅。");
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
        saveVisual(images[i].key!, stage);
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
        ...publishDisplay(stage, images[0]?.stageCandidates),
        coverCrop: { centerX: 0.5, centerY: 0.5, diameter: 1 },
      });
      if (!created.revisionId) reportWebUsage({ event: "publish_success", kind: "FOOD" });
      for (const item of images)
        if (item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
      m.setDraft({
        name: "",
        price: "",
        category: "staple",
        description: "",
        images: [],
        stage: undefined,
        tags: [],
        tagInput: "",
        systemTagIds: [],
        signature: false,
        mealTimes: [],
        deliveryEnabled: false,
        crop: undefined,
        shopName: undefined,
        restaurantId: undefined,
        restaurantPicked: false,
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
        <Link className="pc-composer-back" to="/">
          <Icon name="back" size={15} />
          返回发现
        </Link>
        <h1>分享一道菜</h1>
      </header>
      <form
        className="pc-composer-editor"
        onSubmit={publish}
        aria-label="发布菜品表单"
        aria-busy={!!draft.publishing}
      >
        <fieldset
          className="pc-composer-photo-section"
          aria-labelledby="pc-composer-photo-title"
          disabled={locked || draft.publishUncertain}
        >
          <div className="pc-composer-section-title">
            <h2 id="pc-composer-photo-title">菜品照片</h2>
            <output
              className="pc-composer-photo-count"
              aria-label="已添加照片数（最多 9 张）"
            >
              <strong>{draft.images.length}</strong> / 9
            </output>
          </div>
          <div
            className={`pc-composer-stage${dragging ? " is-dragging" : ""}`}
            data-has-image={!!image}
            style={{ "--composer-stage-color": stage } as CSSProperties}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              if (!locked) setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node))
                setDragging(false);
            }}
            onDrop={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              setDragging(false);
              void addFiles([...event.dataTransfer.files]);
            }}
          >
            {image ? (
              <img
                className="pc-composer-cover"
                src={image.url}
                alt={
                  photoIndex === 0 ? "当前菜品封面" : `菜品照片 ${photoIndex + 1}`
                }
                draggable={false}
              />
            ) : (
              <button
                type="button"
                className="pc-composer-empty-photo"
                aria-label="上传照片"
                onClick={() => input.current?.click()}
              >
                <span className="pc-composer-upload-plate">
                  <Icon name="camera" size={26} />
                  <strong>上传照片</strong>
                  <small>也可拖拽到此处</small>
                </span>
              </button>
            )}
            {image && (
              <button
                type="button"
                className="pc-composer-crop-button"
                onClick={() => setCropUrl(image.url)}
              >
                <Icon name="edit" size={15} />
                调整照片
              </button>
            )}
          </div>
          {(draft.name.trim() || draft.price.trim()) && (
            <div className="pc-composer-preview-name">
              <span>{draft.name.trim()}</span>
              {draft.price.trim() !== "" &&
                Number.isFinite(Number(draft.price)) && (
                  <strong>{money(Number(draft.price))}</strong>
                )}
            </div>
          )}
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
          {image && (
            <PublishPhotoThumbnails
              images={draft.images}
              selected={image.url}
              disabled={locked || !!draft.publishUncertain}
              onSelect={setPreviewUrl}
              onAdd={() => input.current?.click()}
              onRemove={removePhoto}
              onMove={movePhoto}
            />
          )}
          {draft.images.length > 1 && (
            <div className="pc-composer-photo-actions">
              <span>拖动照片调整顺序</span>
              {photoIndex > 0 && (
                <button
                  type="button"
                  onClick={() => movePhoto(image.url, draft.images[0].url)}
                >
                  设为封面
                </button>
              )}
            </div>
          )}
          <p className="pc-composer-photo-help">
            JPG、PNG、WebP，单张不超过 10 MB
          </p>
          {hasPhoto && (
            <div className="pc-composer-palette">
              <div className="pc-composer-palette-heading">
                <strong>{candidates.length ? "舞台色推荐" : "舞台色"}</strong>
                {!!candidates.length && (
                  <button
                    type="button"
                    className="pc-composer-palette-toggle"
                    aria-expanded={showAllColors}
                    aria-controls="pc-composer-stage-colors"
                    onClick={() => setShowAllColors(!showAllColors)}
                  >
                    {showAllColors ? "收起颜色" : "更多颜色"}
                  </button>
                )}
              </div>
              {!!candidates.length && (
                <div className="pc-composer-stage-picks" role="group" aria-label="封面推荐舞台色">
                  {candidates.map((color) => (
                    <button
                      type="button"
                      key={color}
                      aria-pressed={stage === color}
                      onClick={() => m.setDraft({ stage: color })}
                    >
                      <span style={{ background: color }} aria-hidden="true" />
                      {stageNames[stageCode(color)]}
                      {stage === color && <Icon name="check" size={14} />}
                    </button>
                  ))}
                  {!showAllColors && !candidates.includes(stage) && (
                    <span className="pc-composer-stage-current">
                      已选 {stageNames[stageCode(stage)]}
                    </span>
                  )}
                </div>
              )}
              <div
                className="pc-composer-stage-colors"
                id="pc-composer-stage-colors"
                role="group"
                aria-label="其他舞台色"
                hidden={!!candidates.length && !showAllColors}
              >
                {stageColors.filter((color) => !candidates.includes(color)).map((color) => (
                  <button
                    type="button"
                    key={color}
                    style={{
                      background: color,
                      color: stageColors.slice(3, 7).includes(color) ? "white" : undefined,
                    }}
                    aria-label={stageNames[stageCode(color)]}
                    aria-pressed={stage === color}
                    onClick={() => m.setDraft({ stage: color })}
                  >
                    {stage === color && <Icon name="check" size={13} />}
                  </button>
                ))}
                {!!candidates.length && draft.stage && (
                  <button
                    type="button"
                    className="pc-composer-palette-toggle"
                    onClick={() => m.setDraft({ stage: undefined })}
                  >
                    跟随封面
                  </button>
                )}
              </div>
            </div>
          )}
        </fieldset>
        <div className="pc-composer-details">
          <aside
            className="pc-composer-shops"
            aria-labelledby="pc-composer-shop-title"
          >
            <div className="pc-composer-section-title">
              <h2 id="pc-composer-shop-title">餐厅</h2>
              {!selectedId && <span className="pc-required">必选</span>}
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
                      (restaurant.isError
                        ? "餐厅暂时无法读取"
                        : "正在读取餐厅…")}
                  </strong>
                  {selectedShop?.address && (
                    <small>{selectedShop.address}</small>
                  )}
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
                  <div className="pc-composer-search">
                    <Icon name="search" size={17} />
                    <input
                      ref={searchInput}
                      aria-label="搜索发布餐厅"
                      placeholder="搜索店名"
                      value={keyword}
                      disabled={locked || draft.publishUncertain}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.nativeEvent.isComposing
                        )
                          event.preventDefault();
                      }}
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
                  <button
                    type="button"
                    className="pc-composer-area"
                    disabled={locked}
                    onClick={() => m.openPanel("G-PanelPlace")}
                  >
                    <Icon name="nearby" size={15} />
                    {area?.name ?? "选择区域"}
                    <Icon name="chevronDown" size={14} />
                  </button>
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
                                restaurantPicked: true,
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
                              disabled={
                                page === 1 || locked || shops.isFetching
                              }
                              onClick={() => setPage((p) => p - 1)}
                            >
                              上一页
                            </button>
                            <span>{page}</span>
                            <button
                              type="button"
                              disabled={
                                !shops.data?.hasNext ||
                                locked ||
                                shops.isFetching
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
          <fieldset
            className="pc-composer-fields"
            aria-labelledby="pc-composer-fields-title"
            disabled={locked || draft.publishUncertain}
          >
            <div className="pc-composer-section-title">
              <h2 id="pc-composer-fields-title">菜品信息</h2>
            </div>
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
                    placeholder="18"
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
              <div className="pc-composer-kind-heading">
                <span>菜品分类</span>
                <AiTagSuggest
                  compact
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
              </div>
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
              推荐理由 <span>选填</span>
              <textarea
                aria-label="推荐理由"
                placeholder="这道菜哪里值得推荐？"
                value={draft.description}
                aria-invalid={codePoints(draft.description) > foodDescriptionLimit}
                onChange={(event) =>
                  m.setDraft({ description: event.target.value })
                }
              />
            </label>
            <div className="pc-composer-options">
              <DishAvailabilityFields
                value={{
                  mealTimes: draft.mealTimes ?? [],
                  deliveryEnabled: !!draft.deliveryEnabled,
                }}
                disabled={locked || draft.publishUncertain}
                onChange={(next) => m.setDraft(next)}
              />
              <div className="ew-feature ew-meals">
                <label>
                  <input
                    type="checkbox"
                    checked={!!draft.signature}
                    disabled={locked || draft.publishUncertain}
                    onChange={(e) =>
                      m.setDraft({ signature: e.target.checked })
                    }
                  />
                  设为招牌菜
                </label>
              </div>
              <div className="ew-feature ew-meals pc-composer-tastes">
                <b>
                  口味标签 <small>最多 {MAX_DISH_TAGS} 个</small>
                </b>
                {systemTags.isPending && <small>正在读取公共标签…</small>}
                {!systemTags.isPending &&
                  !systemTags.isError &&
                  !systemTags.data?.length && <small>暂无可选口味标签。</small>}
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
                  <button
                    type="button"
                    onClick={() => void systemTags.refetch()}
                  >
                    口味标签加载失败，重试
                  </button>
                )}
              </div>
            </div>
          </fieldset>
        </div>
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
        <footer className="pc-composer-submit">
          <div className="pc-composer-checks" role="status">
            <span data-done={ready && !locked && !draft.publishUncertain}>
              {!(locked || draft.publishUncertain) && (
                <Icon name={ready ? "check" : "info"} size={15} />
              )}
              {draft.publishing
                ? progress
                : draft.publishUncertain
                  ? "发布结果待确认"
                  : photoBusy
                    ? "正在处理照片…"
                    : ready
                      ? "可以发布"
                      : `还需${missing.join("、")}`}
            </span>
          </div>
          <div>
            <button
              type="button"
              className="pc-composer-save"
              title="刷新页面会清空草稿"
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
              className="pc-composer-publish"
              disabled={!ready || locked || draft.publishUncertain}
              label="发布这道菜"
              pending={!!draft.publishing}
              phase={draft.publishPhase}
            >
              <Icon name="chevronRight" size={18} />
            </PublishButton>
          </div>
        </footer>
      </form>
      {cropImage && (
        <CropDialog
          image={cropImage}
          onClose={closeCrop}
          onApply={(result, framing) => {
            const images = draftRef.current.images;
            const old = images.find(({ url }) => url === cropImage.url);
            if (!old) return;
            const url = URL.createObjectURL(result.file);
            const updated = applyPhotoEdit(
              images,
              { source: old.original ?? old.file, targetUrl: old.url },
              result,
              url,
              framing,
            );
            if (old.url.startsWith("blob:")) URL.revokeObjectURL(old.url);
            m.setDraft({ images: updated });
            setPreviewUrl(url);
            closeCrop();
            app.toast("照片已调整，继续完善这道菜吧。");
          }}
        />
      )}
    </div>
  );
}
