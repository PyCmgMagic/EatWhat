import { expect, it } from "vitest";
import { createPhotoGesture } from "./photo-gesture";
import { photoFraming, type PhotoFraming } from "./photo-framing";

const initial = { x: 0, y: 0, zoom: 1 };
const constrain = (crop: PhotoFraming) => photoFraming(1200, 1200, crop).crop;

it("zooms around the two fingers' midpoint while allowing simultaneous panning", () => {
  const gesture = createPhotoGesture();
  gesture.down(1, { x: 0, y: 20 }, initial);
  gesture.down(2, { x: 100, y: 20 }, initial);
  const crop = gesture.move(2, { x: 200, y: 20 }, constrain)!;
  expect(crop).toEqual({ x: 0, y: -20, zoom: 2 });
  // The same source point stays under the midpoint, rather than scaling at centre.
  expect((100 - crop.x) / crop.zoom).toBe(50);
  expect((20 - crop.y) / crop.zoom).toBe(20);
});

it("continues a one-finger drag from the current crop after the second finger lifts", () => {
  const gesture = createPhotoGesture();
  gesture.down(1, { x: -50, y: 0 }, initial);
  gesture.down(2, { x: 50, y: 0 }, initial);
  const pinched = gesture.move(2, { x: 150, y: 0 }, constrain)!;
  gesture.up(2);
  const dragged = gesture.move(1, { x: -35, y: 20 }, constrain)!;
  expect(dragged).toEqual({ x: pinched.x + 15, y: pinched.y + 20, zoom: 2 });
  gesture.up(1);
  expect(gesture.move(1, { x: 100, y: 100 }, constrain)).toBeUndefined();
});

it("can lift the first finger and add another finger without a jump", () => {
  const gesture = createPhotoGesture();
  gesture.down(1, { x: -50, y: 0 }, initial);
  gesture.down(2, { x: 50, y: 0 }, initial);
  const crop = gesture.move(2, { x: 150, y: 0 }, constrain)!;
  gesture.up(1);
  gesture.down(3, { x: -100, y: 0 }, crop);
  expect(gesture.move(3, { x: -100, y: 0 }, constrain)).toEqual(crop);
  gesture.up(2);
  expect(gesture.move(3, { x: -110, y: 0 }, constrain)).toEqual({
    ...crop,
    x: crop.x - 10,
  });
});

it("ignores a third finger and unrelated releases", () => {
  const gesture = createPhotoGesture();
  gesture.down(1, { x: -50, y: 0 }, initial);
  gesture.down(2, { x: 50, y: 0 }, initial);
  expect(gesture.down(3, { x: 500, y: 500 }, initial)).toBe(false);
  gesture.up(3);
  expect(gesture.move(3, { x: -500, y: -500 }, constrain)).toBeUndefined();
  expect(gesture.move(2, { x: 150, y: 0 }, constrain)?.zoom).toBe(2);
});

it("limits zoom to 1–3 and never exposes blank edges", () => {
  const gesture = createPhotoGesture();
  gesture.down(1, { x: -50, y: 0 }, initial);
  gesture.down(2, { x: 50, y: 0 }, initial);
  expect(gesture.move(2, { x: 10000, y: 0 }, constrain)).toEqual({
    x: 300,
    y: 0,
    zoom: 3,
  });
  const reset = gesture.move(2, { x: -49, y: 0 }, constrain)!;
  expect(reset.x).toBeCloseTo(0);
  expect(reset.y).toBeCloseTo(0);
  expect(reset.zoom).toBe(1);
});

it("resets cancelled gestures and handles coincident fingers without invalid numbers", () => {
  const gesture = createPhotoGesture();
  gesture.down(1, { x: 0, y: 0 }, initial);
  gesture.down(2, { x: 0, y: 0 }, initial);
  expect(gesture.move(2, { x: 50, y: 0 }, constrain)).toEqual(initial);
  gesture.reset();
  expect(gesture.move(2, { x: 100, y: 0 }, constrain)).toBeUndefined();
  expect(gesture.down(3, { x: 0, y: 0 }, { x: 0, y: 0, zoom: 2 })).toBe(true);
  expect(gesture.move(3, { x: 15, y: -20 }, constrain)).toEqual({
    x: 15,
    y: -20,
    zoom: 2,
  });
});
