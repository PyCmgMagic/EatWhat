import { Link } from "react-router-dom";
import { DesignIcon as Icon } from "../../mobile/ui";
import {
  mediaUrl,
  money,
  type Restaurant,
  type Schema,
} from "../../api/models";
const topicDates = (topic: Schema["SummaryResponse"]) =>
  [topic.startsAt, topic.endsAt]
    .map((v) =>
      v && Number.isFinite(Date.parse(v))
        ? new Date(v).toLocaleDateString("zh-CN", {
            month: "short",
            day: "numeric",
          })
        : "时间待确认",
    )
    .join(" — ");
export function RestaurantCard({ shop }: { shop: Restaurant }) {
  const image = mediaUrl(shop.coverUrl ?? shop.pictureUrl?.[0]);
  return (
    <Link className="v4-restaurant-card" to={`/restaurants/${shop.id}`}>
      <div className="v4-restaurant-photo">
        {image ? (
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="v4-photo-placeholder">
            <Icon name="store" size={42} />
            <small>店铺图片待补充</small>
          </span>
        )}
        {shop.isFavorite === true && (
          <span className="v4-shop-saved">
            <Icon name="bookmarkOn" size={16} />
            已收藏
          </span>
        )}
        <span
          className="v4-shop-open"
          data-closed={shop.permanentlyClosed || undefined}
        >
          <i />
          {shop.operatingStatus === "SYNC_PENDING"
            ? "状态同步中"
            : shop.permanentlyClosed
              ? "已停业"
              : "营业中"}
        </span>
      </div>
      <div className="v4-restaurant-copy">
        <div className="v4-shop-title">
          <h2>{shop.name}</h2>
          <Icon name="chevronRight" size={18} />
        </div>
        <p className="v4-shop-address">
          <Icon name="pin" size={14} />
          {shop.address || "地址待补充"}
        </p>
        <div className="v4-shop-rating">
          <Icon name="heart" size={15} />
          <span>
            {shop.ratingSummaryState === "SYNC_PENDING"
              ? "评分汇总同步中"
              : shop.recommendationRate == null
                ? "评价人数不足，暂无推荐率"
                : `${shop.recommendationRate}% 的食友推荐`}
          </span>
          {typeof shop.visibleFoodCount === "number" && (
            <small>{shop.visibleFoodCount} 道菜</small>
          )}
        </div>
        <div className="v4-shop-bottom">
          <span>
            <strong>{money(shop.medianPrice)}</strong>
            <small>参考菜价</small>
          </span>
          {shop.distanceMeters != null && (
            <small>
              距你{" "}
              {shop.distanceMeters >= 1000
                ? `${(shop.distanceMeters / 1000).toFixed(1)} km`
                : `${Math.round(shop.distanceMeters)} m`}
            </small>
          )}
        </div>
        {!!shop.matchedFoods?.length && (
          <p className="v4-shop-match">
            找到：
            {shop.matchedFoods
              .map((f) => {
                const price = (f as { price?: number | null }).price;
                return price == null ? f.name : `${f.name} ¥${price}`;
              })
              .join("、")}
          </p>
        )}
      </div>
    </Link>
  );
}
export function TopicCard({
  topic,
  index = 0,
}: {
  topic: Schema["SummaryResponse"];
  index?: number;
}) {
  return (
    <Link
      className={`v4-topic-card tone-${index % 3}`}
      to={`/topics/${topic.id}`}
    >
      <div className="v4-topic-card-art" aria-hidden="true">
        <span>校园专题</span>
        <img
          src={`/prototype/assets/dishes/${["yuntun", "jiaozi", "niandoubao"][index % 3]}.svg`}
          alt=""
        />
      </div>
      <div className="v4-topic-card-copy">
        <small>{topicDates(topic)}</small>
        <h2>{topic.name}</h2>
        <p>{topic.introduction}</p>
        <footer>
          <span>
            {topic.visibleFoodCount != null
              ? `${topic.visibleFoodCount} 道校园好味道`
              : "探索校园好味道"}
          </span>
          <Icon name="chevronRight" size={19} />
        </footer>
      </div>
    </Link>
  );
}
export function TopicHero({
  topic,
  to,
}: {
  topic: Schema["SummaryResponse"];
  to?: string;
}) {
  return (
    <section className="v4-topic-hero">
      <div>
        <span className="v4-kicker">
          <Icon name="topic" size={17} />
          校园美味专题
        </span>
        <h2>{topic.name || "本期专题"}</h2>
        <p>{topic.introduction}</p>
        <span className="v4-topic-date">
          <Icon name="calendar" size={16} />
          {topicDates(topic)}
        </span>
        {to && (
          <Link className="v4-button primary" to={to}>
            浏览专题
            <Icon name="chevronRight" size={18} />
          </Link>
        )}
      </div>
      <div className="v4-topic-hero-art" aria-hidden="true">
        <i />
        <img src="/prototype/assets/dishes/yuntun.svg" alt="" />
        <span>
          这一口，
          <br />
          值得一起分享。
        </span>
      </div>
    </section>
  );
}
