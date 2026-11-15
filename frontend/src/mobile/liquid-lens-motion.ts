export type LensState = {
  left: number;
  right: number;
  leftVelocity: number;
  rightVelocity: number;
};

export const lensDuration = 600;

export function restingLens(left: number, width: number): LensState {
  return { left, right: left + width, leftVelocity: 0, rightVelocity: 0 };
}

// Solve each edge analytically, so a retarget can inherit both its visible
// position and velocity without a frame loop or a fresh animation from rest.
function spring(
  position: number,
  velocity: number,
  target: number,
  seconds: number,
  leading: boolean,
) {
  const stiffness = leading ? 1000 : 420;
  const damping = leading ? 43 : 30;
  const decay = damping / 2;
  const frequency = Math.sqrt(stiffness - decay * decay);
  const displacement = position - target;
  const amplitude = (velocity + decay * displacement) / frequency;
  const sin = Math.sin(frequency * seconds);
  const cos = Math.cos(frequency * seconds);
  const envelope = Math.exp(-decay * seconds);
  return {
    position: target + envelope * (displacement * cos + amplitude * sin),
    velocity:
      envelope *
      ((amplitude * frequency - decay * displacement) * cos -
        (displacement * frequency + decay * amplitude) * sin),
  };
}

// CSS controls share the navigation lens's leading-edge spring. Keeping the
// sampled curve here makes release feedback match without a JS frame loop.
export const liquidReleaseEasing = `linear(${Array.from(
  { length: 61 },
  (_, frame) =>
    frame === 60
      ? 1
      : Number(
          spring(
            0,
            0,
            1,
            ((frame / 60) * lensDuration) / 1000,
            true,
          ).position.toFixed(5),
        ),
).join(", ")})`;

export function liquidLensMotion(
  from: LensState,
  target: number,
  width: number,
  limit: number,
) {
  const direction = target + width / 2 >= (from.left + from.right) / 2 ? 1 : -1;
  const sample = (milliseconds: number): LensState => {
    if (milliseconds >= lensDuration) return restingLens(target, width);
    const seconds = Math.max(0, milliseconds) / 1000;
    const left = spring(
      from.left,
      from.leftVelocity,
      target,
      seconds,
      direction < 0,
    );
    const right = spring(
      from.right,
      from.rightVelocity,
      target + width,
      seconds,
      direction > 0,
    );
    return {
      left: left.position,
      right: right.position,
      leftVelocity: left.velocity,
      rightVelocity: right.velocity,
    };
  };
  const transform = (state: LensState) => {
    // Keep the lens inside the glass shell, including when reversing at an end.
    const left = Math.max(0, Math.min(limit - width * 0.75, state.left));
    const right = Math.min(limit, Math.max(left + width * 0.75, state.right));
    const stretch = (right - left) / width;
    const squash = Math.max(0.88, Math.min(1.045, 1 / Math.sqrt(stretch)));
    return `translateX(${left}px) scale(${stretch}, ${squash})`;
  };
  // Compositor keyframes keep the liquid moving while a destination renders.
  const frames = Array.from({ length: 61 }, (_, frame) => ({
    offset: frame / 60,
    transform: transform(sample((frame / 60) * lensDuration)),
  }));
  return { direction, sample, frames };
}
