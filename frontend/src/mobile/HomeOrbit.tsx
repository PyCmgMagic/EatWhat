import { mediaUrl, type Food } from "../api/models";
import { FoodCover } from "../components/FoodCover";
import { FoodPhotoFallback } from "../components/FoodPhotoFallback";
import { useFoodPhoto } from "../features/media";
import { heroOrbitSlots } from "../motion/hero-orbit";
import { useLayoutEffect, type RefObject } from "react";
import { visualFor } from "./catalog";

export const homePlateSpacing = 1.1;

function homePlateTransform(offset: number) {
  return `translateX(calc(var(--plate-size) * ${offset * homePlateSpacing})) rotate(${offset * 6}deg)`;
}

export function dragHomePlates(element: HTMLElement, progress = 0) {
  for (const plate of element.querySelectorAll<HTMLElement>(
    "[data-orbit-offset]",
  )) {
    plate.style.transform = homePlateTransform(
      Number(plate.dataset.orbitOffset) + progress,
    );
  }
}

function OrbitPlate({ food, demo }: { food: Food; demo: boolean }) {
  const src = mediaUrl(food.pictureUrl?.[0]);
  const photo = useFoodPhoto(src);
  return photo.unavailable ? (
    <FoodPhotoFallback category={food.category} failed={photo.failed} />
  ) : (
    <FoodCover
      crop={food.coverCrop}
      src={src}
      alt=""
      draggable={false}
      className={visualFor(food, demo).asset ? "" : "is-food-photo"}
      onError={photo.onError}
    />
  );
}

export default function HomeOrbit({
  foods,
  position,
  dragging,
  orbitRef,
  demo,
}: {
  foods: Food[];
  position: number;
  dragging: boolean;
  orbitRef: RefObject<HTMLDivElement | null>;
  demo: boolean;
}) {
  useLayoutEffect(() => {
    // React's transform prop is unchanged when a short drag snaps back.
    if (!dragging && orbitRef.current) dragHomePlates(orbitRef.current);
  }, [dragging, orbitRef]);

  if (!foods.length) return null;
  return (
    <div
      className="mobile-home-orbit"
      ref={orbitRef}
      data-dragging={dragging || undefined}
      aria-hidden="true"
    >
      {heroOrbitSlots(position, Math.min(foods.length, 4)).map((slot) => {
        const food =
          foods[((slot % foods.length) + foods.length) % foods.length];
        const offset = slot - position;
        return (
          <div
            key={`${slot}:${food.id}`}
            className="mobile-home-plate"
            data-orbit-slot={slot}
            data-orbit-offset={offset}
            data-food-id={food.id}
            style={{
              transform: homePlateTransform(offset),
              opacity: Math.abs(offset) <= 1 ? 1 : 0,
            }}
          >
            <OrbitPlate food={food} demo={demo} />
          </div>
        );
      })}
    </div>
  );
}
