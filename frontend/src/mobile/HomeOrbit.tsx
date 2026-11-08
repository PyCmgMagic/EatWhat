import { mediaUrl, type Food } from "../api/models";
import { FoodPhotoFallback } from "../components/FoodPhotoFallback";
import { useFoodPhoto } from "../features/media";
import {
  heroOrbitSlots,
  heroOrbitStep,
  heroPlateTransform,
} from "../motion/hero-orbit";
import { visualFor } from "./catalog";
import type { CSSProperties } from "react";

function OrbitPlate({ food, demo }: { food: Food; demo: boolean }) {
  const src = mediaUrl(food.pictureUrl?.[0]);
  const photo = useFoodPhoto(src);
  return photo.unavailable ? (
    <FoodPhotoFallback category={food.category} failed={photo.failed} />
  ) : (
    <img
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
  drag,
  transition,
  demo,
}: {
  foods: Food[];
  position: number;
  drag: number;
  transition: string;
  demo: boolean;
}) {
  if (!foods.length) return null;
  return (
    <div className="mobile-home-orbit" aria-hidden="true">
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
            style={
              {
                // Put the pivot below/right so the departing plate follows the
                // circle below the stage instead of crossing the title and price.
                transform: heroPlateTransform(
                  offset * heroOrbitStep + drag,
                  55,
                ),
                opacity:
                  offset === 0 || (drag !== 0 && Math.abs(offset) === 1)
                    ? 1
                    : 0,
                "--orbit-transition": transition,
                // Keep the outgoing plate visible until it has left the focus area.
                transitionDelay: offset === 0 ? "0ms, 0ms" : "0ms, 180ms",
              } as CSSProperties
            }
          >
            <OrbitPlate food={food} demo={demo} />
          </div>
        );
      })}
    </div>
  );
}
