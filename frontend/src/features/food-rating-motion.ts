import { instantMotion, trackMotion } from "../motion/runtime";

const motionId = "food-rating";

export function stopRatingMotion(row: HTMLElement | null) {
  for (const animation of row?.getAnimations?.({ subtree: true }) ?? []) {
    if (animation.id === motionId) animation.cancel();
  }
}

/** Move only the changed stars, ending the wave at the chosen score. */
export function playRatingMotion(
  row: HTMLElement | null,
  from: number,
  to: number,
) {
  if (!row?.animate || instantMotion()) return;
  const descending = to < from;
  const glyphs = Array.from(
    row.querySelectorAll<SVGElement>(".food-rating-glyph"),
  );
  // Snapshot before interrupting an earlier wave so a quick rescore starts in place.
  const starts = glyphs.map((glyph) => {
    const style = getComputedStyle(glyph);
    return { transform: style.transform, fill: style.fill };
  });
  stopRatingMotion(row);
  glyphs.forEach((glyph, index) => {
    const score = index + 1;
    const landing = score === to;
    if (!landing && (score <= Math.min(from, to) || score > Math.max(from, to)))
      return;
    const delay = descending ? (from - score) * 24 : (score - from - 1) * 32;
    const fill = score <= to ? "var(--rating-fill)" : "transparent";
    const peak = landing
      ? "translateY(-6px) rotate(9deg) scale(1.22)"
      : descending
        ? "translateY(2px) rotate(6deg) scale(0.86)"
        : "translateY(-3px) rotate(-7deg) scale(1.09)";
    trackMotion(
      glyph.animate(
        [
          starts[index],
          { transform: peak, fill, offset: 0.4 },
          { transform: "none", fill },
        ],
        {
          id: motionId,
          duration: landing ? 300 : 185,
          delay,
          easing: "ease-out",
          fill: "backwards",
        },
      ),
    );
    if (landing) {
      const sparks = glyph.parentElement?.querySelector(".food-rating-sparks");
      if (sparks)
        trackMotion(
          sparks.animate(
            [
              { opacity: 0, transform: "scale(.64)" },
              { opacity: 1, transform: "scale(.92)", offset: 0.27 },
              { opacity: 0, transform: "scale(1.16)" },
            ],
            {
              id: motionId,
              duration: 260,
              delay: delay + 40,
              easing: "ease-out",
            },
          ),
        );
    }
  });
}
