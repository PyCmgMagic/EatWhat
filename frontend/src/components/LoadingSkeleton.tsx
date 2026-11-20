import type { CSSProperties } from "react";
import "./loading.css";

export function Skeleton({
  width = "100%",
  height = 16,
  round = false,
}: {
  width?: string | number;
  height?: string | number;
  round?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`ew-skeleton ${round ? "round" : ""}`}
      style={
        {
          width,
          height: height === "auto" ? undefined : height,
        } as CSSProperties
      }
    />
  );
}

export function ContentSkeleton({
  kind = "cards",
  count = 6,
}: {
  kind?: "cards" | "rows" | "form";
  count?: number;
}) {
  return (
    <div
      className={`ew-content-skeleton ${kind}`}
      role="status"
      aria-label="正在加载内容"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <div className="ew-skeleton-item" key={i} aria-hidden="true">
          {kind !== "form" && (
            <Skeleton
              height={kind === "cards" ? "auto" : 56}
              width={kind === "cards" ? "100%" : 56}
              round={kind === "rows"}
            />
          )}
          <div className="ew-skeleton-copy">
            <Skeleton width="66%" height={20} />
            <Skeleton width="88%" height={13} />
            {kind === "cards" && <Skeleton width="40%" height={13} />}
            {kind === "form" && <Skeleton height={44} />}
          </div>
        </div>
      ))}
    </div>
  );
}

export type PageSkeletonKind = "home" | "dish" | "restaurant" | "profile";
export function PageSkeleton({ kind }: { kind: PageSkeletonKind }) {
  return (
    <div
      className={`ew-page-skeleton ${kind}`}
      role="status"
      aria-label="正在加载页面"
      aria-busy="true"
    >
      {kind === "home" ? (
        <>
          <div className="pc-hero ew-skeleton-hero">
            <div className="pc-hero-copy">
              <Skeleton width="55%" />
              <Skeleton
                height="var(--hero-skeleton-heading, 156px)"
                width="80%"
              />
              <Skeleton width="45%" />
            </div>
            <div className="pc-hero-food">
              <Skeleton width="var(--plate-size)" height="auto" round />
            </div>
          </div>
          <section className="pc-content-sheet">
            <Skeleton width={230} height={30} />
            <ContentSkeleton />
          </section>
        </>
      ) : kind === "dish" ? (
        <>
          <Skeleton width="30%" height={20} />
          <div className="pc-dish-layout">
            <div className="pc-dish-stage">
              <div className="pc-dish-gallery">
                <Skeleton width="var(--dish-plate-size)" height="auto" round />
              </div>
            </div>
            <div className="pc-dish-info">
              <div className="pc-dish-byline"><Skeleton width="36%" height={34} /></div>
              <div className="pc-dish-reading">
                <Skeleton width="65%" height={32} />
                <ContentSkeleton kind="rows" count={2} />
              </div>
              <div className="pc-dish-actions"><Skeleton height={44} /></div>
            </div>
          </div>
        </>
      ) : kind === "restaurant" ? (
        <>
          <Skeleton width="30%" height={20} />
          <section className="pc-restaurant-hero ew-skeleton-hero">
            <div>
              <Skeleton width="55%" />
              <Skeleton width="85%" height={48} />
              <Skeleton width="75%" />
              <Skeleton width="45%" height={48} />
            </div>
            <div className="pc-restaurant-hero-plate">
              <Skeleton width="100%" height="100%" round />
            </div>
          </section>
          <section className="pc-content-sheet">
            <Skeleton width={230} height={30} />
            <ContentSkeleton />
          </section>
        </>
      ) : (
        <div className="pc-profile-layout">
          <aside className="pc-profile-rail">
            <div className="pc-profile-card ew-skeleton-profile">
              <Skeleton width={80} height={80} round />
              <Skeleton width="65%" height={28} />
              <Skeleton />
              <Skeleton height={48} />
            </div>
          </aside>
          <section className="pc-profile-content">
            <Skeleton width="60%" height={28} />
            <ContentSkeleton />
          </section>
        </div>
      )}
    </div>
  );
}

// Fill the current canvas, whether it is fluid or a scaled reference artboard.
export function MobilePageSkeleton({ screen }: { screen: string }) {
  const profile = screen === "G-Me" || screen === "G-UserProfile";
  const hero =
    profile ||
    ["G2-Home", "G-HomePhoto", "G-Dish", "G-Detail", "G-Nearby"].includes(
      screen,
    );
  return (
    <div
      className={`ew-mobile-skeleton ${profile ? "profile" : ""}`}
      role="status"
      aria-label="正在加载页面"
      aria-busy="true"
    >
      <div className={`ew-mobile-skeleton-top ${hero ? "hero" : ""}`}>
        <Skeleton width="32%" height={18} />
        {hero && (
          <Skeleton
            width={profile ? 64 : 196}
            height={profile ? 64 : 196}
            round
          />
        )}
        <Skeleton width="72%" height={32} />
        <Skeleton width="52%" />
        {profile && (
          <div className="ew-mobile-skeleton-stats">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width={46} height={38} />
            ))}
          </div>
        )}
      </div>
      <section className="ew-mobile-skeleton-sheet">
        <Skeleton width="45%" height={24} />
        <ContentSkeleton
          kind={
            screen === "G-Inbox" || screen === "G-History" ? "rows" : "cards"
          }
          count={4}
        />
      </section>
    </div>
  );
}
