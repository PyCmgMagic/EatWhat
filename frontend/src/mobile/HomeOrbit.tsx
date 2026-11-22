import { mediaUrl, type Food } from "../api/models";
import { FoodCover } from "../components/FoodCover";
import { FoodPhotoFallback } from "../components/FoodPhotoFallback";
import { useFoodPhoto } from "../features/media";
import { heroOrbitSlots, heroPlateTransform } from "../motion/hero-orbit";
import { useLayoutEffect, type RefObject } from "react";
import { visualFor } from "./catalog";

// A 60° step at this radius keeps adjacent plates about 1.1 widths apart.
const homeOrbitStep = 60;
const homeOrbitRadiusPercent = 127;
const homeOrbitFadeAngle = 12;
const radiansPerDegree = Math.PI / 180;
const maxDragRatio = Math.sin(homeOrbitStep * radiansPerDegree);

export function homeOrbitDragAngle(distance: number, plateWidth: number) {
  const radius = (plateWidth * homeOrbitRadiusPercent) / 100;
  const ratio = Math.max(-maxDragRatio, Math.min(maxDragRatio, distance / radius));
  return Math.asin(ratio) / radiansPerDegree;
}

function homePlateStyle(angle: number) {
  // The pivot sits straight below the plate, so the arc is horizontal at its top.
  const transform = heroPlateTransform(angle, `${homeOrbitRadiusPercent}%`);
  const opacity = Math.max(
    0,
    Math.min(1, (homeOrbitStep - Math.abs(angle)) / homeOrbitFadeAngle),
  );
  return { transform, opacity };
}

export function dragHomePlates(element: HTMLElement, angle = 0) {
  for (const plate of element.querySelectorAll<HTMLElement>(
    "[data-orbit-offset]",
  )) {
    const offset = Number(plate.dataset.orbitOffset);
    const { transform, opacity } = homePlateStyle(offset * homeOrbitStep + angle);
    plate.style.transform = transform;
    plate.style.opacity = String(opacity);
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
    // The style props are unchanged when a short drag snaps back.
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
            style={homePlateStyle(offset * homeOrbitStep)}
          >
            <OrbitPlate food={food} demo={demo} />
          </div>
        );
      })}
    </div>
  );
}
