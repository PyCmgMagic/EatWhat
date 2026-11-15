import { foodAuthor } from "../api/models";
import { FoodCover } from "../components/FoodCover";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  categories,
  mediaUrl,
  money,
  parseId,
  type Food,
  type Restaurant,
} from "../api/models";
import { useFoodImageRefresh } from "../features/media";
import { DesignIcon } from "./ui";
import { DishMoreActions } from "./DishMoreActions";
import { visualFor } from "./catalog";
import "./dish-detail.css";
import { SupplementPrice } from "../features/SupplementPrice";
import { FoodCommentPreview } from "../features/comments/Comments";

type Props = {
  food: Food;
  restaurant?: Restaurant;
  back: string;
  demo: boolean;
  sharedAt: string;
  likeDisabled: boolean;
  favoriteDisabled: boolean;
  onLike: () => void;
  onFavorite: () => void;
  onShare: () => void;
  onTags: () => void;
  onRestaurant: () => void;
  management: ReactNode;
  footer: ReactNode;
};

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
  const visual = visualFor(food, demo),
    src = mediaUrl(food.pictureUrl?.[0]);
  const renewImage = useFoodImageRefresh();
  const restaurantId = parseId(String(food.restaurantId));
  const authorId = foodAuthor(food).id;
  const tags = food.systemTags ?? [];
  const author = (
    <>
      <span className="mobile-avatar">
        {foodAuthor(food).name?.slice(0, 1) || "食"}
      </span>
      <span className="dish-author-copy">
        <strong>{foodAuthor(food).name || "校园食友"}</strong>
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
      className="design-screen mobile-dish-screen"
      data-screen="G-Dish"
      style={
        {
          "--dish-stage": visual.stage,
          "--dish-ink": visual.on,
          "--dish-glass": visual.ghost,
        } as CSSProperties
      }
    >
      <div className="dish-hero">
        <header className="dish-toolbar">
          <Link className="dish-icon-button" to={back} aria-label="返回">
            <DesignIcon name="back" size={22} />
          </Link>
          <div className="dish-toolbar-actions">
            <button
              type="button"
              className="dish-icon-button"
              aria-label={food.isFavorite ? "取消收藏" : "收藏"}
              aria-pressed={food.isFavorite === true}
              disabled={favoriteDisabled}
              onClick={onFavorite}
            >
              <DesignIcon
                name={food.isFavorite ? "bookmarkOn" : "bookmark"}
                size={22}
              />
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
          </div>
          <div
            className={`dish-plate${visual.asset ? " is-illustration" : ""}`}
          >
            {src ? (
              <FoodCover
                crop={food.coverCrop}
                src={src}
                alt={food.name || "菜品照片"}
                onError={() => renewImage(src)}
              />
            ) : (
              <DesignIcon name="bowl" size={64} />
            )}
          </div>
        </div>
      </div>
      <div className="dish-sheet mobile-detail-sheet">
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
            className="dish-like"
            aria-label={food.isLiked ? "取消喜欢这道菜" : "喜欢这道菜"}
            aria-pressed={food.isLiked === true}
            disabled={likeDisabled}
            onClick={onLike}
          >
            <DesignIcon name={food.isLiked ? "heartOn" : "heart"} size={20} />
            <span>{food.isLiked ? "已喜欢" : "喜欢"}</span>
            <b>{food.likesCount ?? "—"}</b>
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
