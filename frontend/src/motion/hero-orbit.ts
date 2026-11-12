export const heroOrbitStep = 55;

/** Keep the same transform list so the browser interpolates the angle on an arc. */
export function heroPlateTransform(angle: number, tilt = 0) {
  const scale = 1 - 0.15 * Math.min(1, Math.abs(angle) / heroOrbitStep);
  const arc = `translateY(var(--orbit-radius)) rotate(${angle}deg) translateY(calc(-1 * var(--orbit-radius)))`;
  return `${tilt ? `rotate(${-tilt}deg) ` : ""}${arc}${tilt ? ` rotate(${tilt}deg)` : ""} scale(${scale})`;
}

/** Logical slots keep visible plates continuous when the food index wraps. */
export function heroOrbitSlots(position: number, count: number) {
  const span = count > 1 ? Math.max(2, Math.ceil(count / 2)) : 0;
  return Array.from({ length: span * 2 + 1 }, (_, i) => position + i - span);
}

export function nearestHeroPosition(
  position: number,
  index: number,
  count: number,
) {
  let delta = (((index - position) % count) + count) % count;
  if (delta > count / 2) delta -= count;
  return position + delta;
}

/** Update the moving plates directly; pointer movement does not re-render the page. */
export function dragHeroOrbit(element: HTMLElement, angle = 0, tilt = 0) {
  for (const plate of element.querySelectorAll<HTMLElement>(
    "[data-orbit-offset]",
  )) {
    const offset = Number(plate.dataset.orbitOffset);
    plate.style.transform = heroPlateTransform(
      offset * heroOrbitStep + angle,
      tilt,
    );
  }
}
