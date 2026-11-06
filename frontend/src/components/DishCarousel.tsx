import { useEffect, useRef, type CSSProperties } from "react";
import "./dish-carousel.css";

const dishes = [
  "yuntun",
  "niunan",
  "yangzhi",
  "luosifen",
  "tieguodun",
  "xiangguo",
  "niandoubao",
  "jiaozi",
  "yuntun",
  "yangzhi",
  "xiangguo",
  "jiaozi",
];

export function DishCarousel() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let visible = false;
    const update = () => {
      element.dataset.playing = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="auth-dish-carousel"
      data-playing="false"
      aria-hidden="true"
    >
      <div className="auth-dish-wheel">
        {dishes.map((dish, index) => (
          <img
            key={`${dish}-${index}`}
            src={`/prototype/assets/dishes/${dish}.svg`}
            alt=""
            draggable={false}
            style={{ "--dish-angle": `${index * 30}deg` } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
