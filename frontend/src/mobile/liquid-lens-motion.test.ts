import { describe, expect, it } from "vitest";
import {
  lensDuration,
  liquidLensMotion,
  restingLens,
} from "./liquid-lens-motion";

describe("liquid navigation lens", () => {
  it.each([1, -1])(
    "stretches toward the destination and recoils in direction %i",
    (direction) => {
      const width = 90;
      const start = direction > 0 ? 0 : 184;
      const motion = liquidLensMotion(
        restingLens(start, width),
        92,
        width,
        274,
      );
      const states = Array.from({ length: 60 }, (_, index) =>
        motion.sample(index * 10),
      );
      const widths = states.map((state) => state.right - state.left);
      expect(Math.max(...widths)).toBeGreaterThan(width * 1.2);
      expect(Math.min(...widths)).toBeLessThan(width * 0.99);
      expect(motion.direction).toBe(direction);
      expect(motion.sample(lensDuration)).toEqual(restingLens(92, width));
      expect(Math.abs(motion.sample(lensDuration - 10).left - 92)).toBeLessThan(
        0.1,
      );
    },
  );

  it("preserves position and velocity through repeated rapid reversals", () => {
    const width = 90;
    let motion = liquidLensMotion(restingLens(0, width), 184, width, 274);
    for (const [time, target] of [
      [70, 0],
      [45, 184],
      [85, 92],
      [30, 0],
      [100, 184],
    ]) {
      const visible = motion.sample(time);
      motion = liquidLensMotion(visible, target, width, 274);
      const retargeted = motion.sample(0);
      for (const key of [
        "left",
        "right",
        "leftVelocity",
        "rightVelocity",
      ] as const) {
        expect(retargeted[key]).toBeCloseTo(visible[key], 8);
      }
      expect(motion.sample(lensDuration)).toEqual(restingLens(target, width));
    }
  });

  it.each([68, 90, 136])(
    "keeps all rendered frames inside the shell at width %i",
    (width) => {
      const end = 2 * (width + 2);
      const limit = end + width;
      let state = restingLens(0, width);
      for (const target of [end, 0, end / 2, end, 0]) {
        const motion = liquidLensMotion(state, target, width, limit);
        for (const frame of motion.frames) {
          const [x, scaleX, scaleY] = frame.transform
            .match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!
            .map(Number);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x + width * scaleX).toBeLessThanOrEqual(limit + 0.001);
          expect(scaleX).toBeGreaterThanOrEqual(0.749);
          expect(scaleY).toBeGreaterThanOrEqual(0.88);
          expect(scaleY).toBeLessThanOrEqual(1.045);
        }
        state = motion.sample(70);
      }
    },
  );
});
