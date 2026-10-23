import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useArea } from "../app/area";
import { categories, money } from "../api/models";
import { FoodGrid } from "../components/FoodCard";
import {
  Empty,
  ErrorState,
  Gate,
  Icon,
  Intro,
  Loading,
  Picture,
} from "../components/ui";

export function Hero() {
  return (
    <section className="hero-grid" aria-label="今日灵感">
      <div className="welcome-panel">
        <div className="welcome-copy">
          <div className="eyebrow">校园里的美味日常</div>
          <h2>
            <span className="hero-underline">好好吃饭，</span>
            <br />
            是今天的
            <span className="mobile-title-break">
              <br />
            </span>
            正经事。
          </h2>
          <p>
            食堂里的隐藏菜单，校门口的新发现。
            <br />
            和同学们一起，把每一顿吃成小期待。
          </p>
          <Link className="btn btn-primary" to="/recommend">
            找找这一餐的灵感
            <Icon name="arrow" />
          </Link>
        </div>
        <div className="hero-food-ticket">
          <img
            src="/assets/noodles.jpg"
            alt="午餐灵感：一碗热汤拉面"
            width="400"
            height="350"
          />
          <span className="ticket-sticker">认真吃饭俱乐部</span>
          <div className="ticket-caption">
            <strong>热乎的一碗 · 午餐灵感</strong>
            <span>✳</span>
          </div>
        </div>
        <span className="ticket-flower" aria-hidden="true">
          ✳
        </span>
      </div>
      <Link className="inspiration-card" to="/recommend">
        <span className="eyebrow">吃饭不纠结</span>
        <h2>
          换个口味？
          <br />
          让这一餐
          <br />
          有点小惊喜。
        </h2>
        <p>给选择困难的你，一点灵感。</p>
        <span className="round-arrow">
          <Icon name="arrow" />
        </span>
        <span className="orbit-decoration" aria-hidden="true" />
      </Link>
    </section>
  );
}
export default function Discover() {
  const { openArea, area } = useArea();
  return (
    <>
      <Intro
        title="今天，想吃点什么？"
        subtitle="好吃的东西，当然要和同校的你分享。"
      />
      <Hero />
      <section>
        <div className="section-title">
          <h2>
            在校园，循着香味找一找
            <span className="tiny-label">GOOD FOOD, GOOD MOOD</span>
          </h2>
          <button className="text-link" onClick={openArea}>
            {area?.name || "选择区域"}
            <Icon name="pin" />
          </button>
        </div>
        <div className="tabs-and-sort">
          <span className="feed-tab active">同学推荐</span>
          <Link className="feed-tab" to="/restaurants">
            找餐厅
          </Link>
          <span className="feed-sort">一组好味道，慢慢挑</span>
        </div>
        <Gate>
          <Recommendations />
        </Gate>
      </section>
      <div className="bottom-invite">
        <div>
          <strong>你的私藏，也许正是别人的下一餐。</strong>
          <p>给今天吃到的美味，留一个小小的记录。</p>
        </div>
        <Link className="text-link" to="/publish">
          分享一份好味道
          <Icon name="arrow" />
        </Link>
      </div>
    </>
  );
}
function Recommendations() {
  const { api } = useApp(),
    [category, setCategory] = useState("");
  const q = useQuery({
    queryKey: ["foods", "recommend", 8],
    queryFn: () => api.recommend(8),
  });
  const foods =
    q.data?.filter((f) => !category || f.category === category) ?? [];
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      <div className="filter-row">
        <div className="chips">
          {categories.slice(0, 6).map((c) => (
            <button
              key={c.id}
              className={`chip ${category === c.id ? "active" : ""}`}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              <Icon name={c.icon} />
              {c.label}
            </button>
          ))}
        </div>
        <span className="filter-count">筛选本组 {q.data.length} 道</span>
      </div>
      {foods.length ? (
        <FoodGrid foods={foods} />
      ) : (
        <Empty
          title="这组推荐里，暂时没有这个口味"
          action={
            <button
              className="btn btn-secondary"
              onClick={() => setCategory("")}
            >
              看看全部推荐
            </button>
          }
        >
          也可以去餐厅里发现更多好味道。
        </Empty>
      )}
      <p className="section-caption">
        这里展示一组推荐；寻找更多菜品，可以先
        <Link to="/restaurants">找到餐厅 ↗</Link>。
      </p>
    </>
  );
}
export function Recommend() {
  return (
    <>
      <Intro
        title="今天吃什么，让灵感来决定。"
        subtitle="不必每餐都纠结，给新口味一次机会。"
      />
      <Gate>
        <RecommendContent />
      </Gate>
    </>
  );
}
function RecommendContent() {
  const { api, toast } = useApp(),
    [index, setIndex] = useState(0);
  const q = useQuery({
    queryKey: ["foods", "recommend", 10],
    queryFn: () => api.recommend(10),
  });
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const foods = q.data,
    food = foods[index % Math.max(foods.length, 1)];
  if (!food)
    return (
      <Empty
        title="今天的饭卡还在等一道好菜"
        action={
          <Link to="/publish" className="btn btn-primary">
            去分享一道菜
          </Link>
        }
      >
        推荐暂时为空，可以从餐厅浏览或贡献你的私藏。
      </Empty>
    );
  return (
    <>
      <div className="recommend-layout">
        <article className="meal-ticket">
          <div className="meal-ticket-top">
            <strong>今日饭卡</strong>
            <span className="ticket-serial">GOOD FOOD TICKET</span>
          </div>
          <Link to={`/foods/${food.id}`} className="meal-ticket-photo">
            <Picture
              src={food.pictureUrl?.[0]}
              alt={food.name || "推荐菜品"}
              eager
            />
            <span className="photo-label">给这一餐，一点小惊喜</span>
          </Link>
          <div className="meal-ticket-bottom">
            <div>
              <h2>{food.name}</h2>
              <p>{food.restaurantName || "餐厅信息待补充"}</p>
            </div>
            <span className="food-price">{money(food.price)}</span>
          </div>
        </article>
        <div className="recommend-copy">
          <span className="eyebrow">好好吃饭计划</span>
          <h2>
            生活再忙，
            <br />
            也要好好吃饭。
          </h2>
          <p>
            从这一组好味道里，找一个心动的选择。
            <br />
            这一餐，就从一点新鲜感开始。
          </p>
          <button
            className="btn btn-primary"
            disabled={foods.length < 2}
            onClick={() => setIndex((i) => i + 1)}
          >
            <Icon name="shuffle" />
            换一张饭卡
          </button>
          <Link to={`/foods/${food.id}`} className="btn btn-secondary">
            看看这道菜
            <Icon name="arrow" />
          </Link>
          <button
            className="text-link"
            disabled={q.isFetching}
            onClick={async () => {
              const result = await q.refetch();
              if (result.isError) toast("换一组失败，请重试。");
              else {
                setIndex(0);
                toast("已获取一组推荐，可能包含看过的菜品。");
              }
            }}
          >
            {q.isFetching ? "正在寻找…" : "再找一组灵感 ↗"}
          </button>
          <span className="recommend-footnote">
            候选来自同学分享，推荐可能重复。
            <br />
            价格、位置以实际到店为准。
          </span>
        </div>
      </div>
      <div className="section-title">
        <h2>还有这些，也值得一试。</h2>
        <Link className="text-link" to="/restaurants">
          去餐厅找找
          <Icon name="arrow" />
        </Link>
      </div>
      <FoodGrid foods={foods.filter((f) => f.id !== food.id).slice(0, 4)} />
    </>
  );
}
