import { foodAuthor } from "../api/models";
import { FoodCover } from "../components/FoodCover";
import { PhotoPreviewButton } from "../components/PhotoPreviewButton";
import { UserAvatar } from "../components/UserAvatar";
import { UserTitle } from "../components/UserTitle";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  categories,
  mediaUrl,
  money,
  parseId,
  type Food,
  type Restaurant,
} from "../api/models";
import { useFoodPhoto } from "../features/media";
import { useCelebration } from "../features/food-reactions";
import { DesignIcon, ReactionIcon } from "./ui";
import { DishMoreActions } from "./DishMoreActions";
import { useDishScroll } from "./useDishScroll";
import { visualFor } from "./catalog";
import "./sheet-handle.css";
import "./dish-detail.css";
import { SupplementPrice } from "../features/SupplementPrice";
import { FoodCommentPreview } from "../features/comments/Comments";
import { FoodRating } from "../features/FoodRating";
import { availabilityText } from "../features/DishAvailability";

type Props = {
  food: Food;
  restaurant?: Restaurant;
  back: string;
  demo: boolean;
  sharedAt: string;
  likeDisabled: boolean;
  favoriteDisabled: boolean;
  onLike: () => unknown;
  onFavorite: () => unknown;
  onShare: () => void;
  onTags: () => void;
  onRestaurant: () => void;
  management: ReactNode;
  footer: ReactNode;
};

function useOptimisticReaction(serverValue: boolean, onToggle: () => unknown) {
  const [pending, setPending] = useState<boolean | null>(null);
  const active = pending ?? serverValue;
  const celebration = useCelebration(260);
  const prevServer = useRef(serverValue);

  useEffect(() => {
    if (pending === null) return;
    if (pending === serverValue) {
      setPending(null);
      return;
    }
    // The request never came back: fall back to the server value.
    const timer = window.setTimeout(() => setPending(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pending, serverValue]);

  useEffect(() => {
    if (prevServer.current && !serverValue && pending === null) {
      celebration.stop();
    }
    prevServer.current = serverValue;
  }, [serverValue, pending, celebration]);

  const toggle = () => {
    const next = !active;
    if (next) celebration.trigger();
    else celebration.stop();
    setPending(next === serverValue ? null : next);
    const result = onToggle();
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      void (result as Promise<unknown>).catch(() => {
        setPending(null);
        celebration.stop();
      });
    }
  };

  return { active, celebrating: celebration.celebrating, toggle };
}

export default function DishDetail({
  food,
  restaurant,
  back,
  demo,
  sharedAt,
  likeDisabled,
  favoriteDisabled,
  onLike,
  onFavorite,
  onShare,
  onTags,
  onRestaurant,
  management,
  footer,
}: Props) {
  const { screen, handleProps } = useDishScroll();
  const sheetId = useId();
  const visual = visualFor(food, demo),
    src = mediaUrl(food.pictureUrl?.[0]);
  const photo = useFoodPhoto(src);
  const serverLiked = food.isLiked === true;
  const like = useOptimisticReaction(serverLiked, onLike);
  const favorite = useOptimisticReaction(food.isFavorite === true, onFavorite);
  const likesCount = Math.max(
    0,
    (food.likesCount ?? 0) +
      (like.active === serverLiked ? 0 : like.active ? 1 : -1),
  );
  const restaurantId = parseId(String(food.restaurantId));
  const { id: authorId, name: authorName } = foodAuthor(food);
  const tags = food.systemTags ?? [];
  const author = (
    <>
      <UserAvatar
        className="mobile-avatar"
        avatar={food.user?.avatar}
        name={authorName}
      />
      <span className="dish-author-copy">
        <strong>{authorName}</strong>
        <UserTitle title={food.user?.title} />
        <small>{sharedAt ? `${sharedAt}分享` : "菜品分享者"}</small>
      </span>
      {authorId && <DesignIcon name="chevronRight" size={16} />}
    </>
  );
  const shop = (
    <>
      <span className="dish-shop-icon">
        <DesignIcon name="store" size={22} />
      </span>
      <span className="dish-shop-copy">
        <strong>
          {restaurant?.name || food.restaurantName || "餐厅信息待补充"}
        </strong>
        <span>
          {restaurant?.address || food.restaurantAddress || "地址待补充"}
        </span>
      </span>
      {restaurantId && <DesignIcon name="chevronRight" size={18} />}
    </>
  );
  return (
    <article
      ref={screen}
      className="design-screen mobile-dish-screen"
      data-screen="G-Dish"
      data-food-stage={visual.stageTone}
      style={
        {
          "--dish-stage": visual.stageSurface,
          "--dish-ink": visual.on,
          "--dish-glass": visual.ghost,
        } as CSSProperties
      }
    >
      <header className="dish-toolbar" aria-label="菜品操作">
        <Link className="dish-icon-button" to={back} aria-label="返回">
          <DesignIcon name="back" size={22} />
        </Link>
        <div className="dish-toolbar-summary" aria-hidden="true">
          <strong role="heading" aria-level={1} title={food.name || "这道菜"}>
            {food.name || "这道菜"}
          </strong>
          <span>{money(food.price)}</span>
        </div>
        <div className="dish-toolbar-actions">
          <button
            type="button"
            className={`dish-icon-button dish-favorite${favorite.celebrating ? " is-celebrating" : ""}`}
            aria-label={favorite.active ? "取消收藏" : "收藏"}
            aria-pressed={favorite.active}
            disabled={favoriteDisabled}
            onClick={favorite.toggle}
          >
            <ReactionIcon kind="favorite" size={22} />
          </button>
          <button
            type="button"
            className="dish-icon-button"
            aria-label="分享菜品"
            onClick={onShare}
          >
            <DesignIcon name="share" size={22} />
          </button>
          {food.id && (
            <DishMoreActions
              key={food.id}
              foodId={food.id}
              foodName={food.name}
              management={management}
            />
          )}
        </div>
      </header>
      <div className="dish-hero">
        <div className="dish-hero-content">
          <div className="dish-hero-copy">
            <span className="dish-category">
              {categories.find((c) => c.id === food.category)?.label || "菜品"}
              {(food as typeof food & { signature?: boolean | null })
                .signature && " · 招牌菜"}
            </span>
            <h1>{food.name || "这道菜"}</h1>
            <p
              className={`dish-price${food.price == null ? " is-unknown" : ""}`}
            >
              {money(food.price)}
              <SupplementPrice food={food} />
            </p>
            {availabilityText(food) && (
              <p className="dish-availability-note">{availabilityText(food)}</p>
            )}
          </div>
          <div
            className={`dish-plate${visual.asset ? " is-illustration" : ""}`}
          >
            {!photo.unavailable ? (
              <>
                <FoodCover
                  crop={food.coverCrop}
                  src={src}
                  alt={food.name || "菜品照片"}
                  onError={photo.onError}
                />
                <PhotoPreviewButton
                  pictures={food.pictureUrl}
                  name={food.name || "菜品"}
                  onImageError={photo.renew}
                />
              </>
            ) : (
              <DesignIcon name="bowl" size={64} />
            )}
          </div>
        </div>
      </div>
      <div className="dish-sheet mobile-detail-sheet" id={sheetId}>
        <button
          type="button"
          className="mobile-sheet-handle dish-sheet-handle"
          aria-controls={sheetId}
          {...handleProps}
        >
          <span aria-hidden="true" />
        </button>
        {restaurantId ? (
          <Link
            className="dish-shop"
            to={`/restaurants/${restaurantId}`}
            onClick={onRestaurant}
          >
            {shop}
          </Link>
        ) : (
          <div className="dish-shop">{shop}</div>
        )}
        <div className="dish-actions">
          <button
            type="button"
            className={`dish-like${like.celebrating ? " is-celebrating" : ""}`}
            aria-label={like.active ? "取消喜欢这道菜" : "喜欢这道菜"}
            aria-pressed={like.active}
            disabled={likeDisabled}
            onClick={like.toggle}
          >
            <ReactionIcon kind="like" size={20} />
            <span>{like.active ? "已喜欢" : "喜欢"}</span>
            <b>{food.likesCount == null ? "—" : likesCount}</b>
          </button>
          {restaurantId ? (
            <Link
              className="dish-visit"
              to={`/restaurants/${restaurantId}`}
              onClick={onRestaurant}
            >
              <DesignIcon name="navigate" size={18} />
              去这家店
            </Link>
          ) : (
            <button type="button" className="dish-visit" disabled>
              餐厅待补充
            </button>
          )}
        </div>
        <FoodRating food={food} />
        <section className="dish-story" aria-label="食友分享">
          <h2>食友分享</h2>
          <p
            className={`dish-description${food.description ? "" : " is-empty"}`}
          >
            {food.description || "分享者还没有留下用餐感受。"}
          </p>
          {authorId ? (
            <Link className="mobile-contributor" to={`/users/${authorId}`}>
              {author}
            </Link>
          ) : (
            <div className="mobile-contributor">{author}</div>
          )}
        </section>
        {/* v2: the author picks the taste tags when posting. */}
        {tags.length > 0 && (
          <section className="dish-tastes" aria-label="口味">
            <div className="dish-section-heading">
              <h2>口味</h2>
            </div>
            <div className="dish-tag-list">
              {tags.map((tag) => (
                <span key={tag.id}>{tag.name}</span>
              ))}
            </div>
          </section>
        )}
        {food.id && <FoodCommentPreview foodId={food.id} />}
        {footer}
      </div>
    </article>
  );
}
