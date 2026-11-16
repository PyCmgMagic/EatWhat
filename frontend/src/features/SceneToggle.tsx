import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
} from "react";
import { recommendScenes, type RecommendScene } from "../api/v2-vocab";
import "./scene-toggle.css";

/* Some hosts (the mobile home header) remount the switch when the scene
   changes. Remembering the last placed scene lets the new instance start the
   pill where the old one ended instead of teleporting. */
let lastPlaced: RecommendScene | null = null;

/** The layout facts the pill is sized from, as a comparable string. */
function geometryOf(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>('[role="radio"]')]
    .map((option) => {
      const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = option;
      return `${offsetLeft},${offsetTop},${offsetWidth},${offsetHeight}`;
    })
    .join("|");
}

/** Dine-in / delivery switch for the recommendation feed. */
export function SceneToggle({
  value,
  onChange,
  tone = "light",
  stage,
}: {
  value: RecommendScene;
  onChange: (scene: RecommendScene) => void;
  /** "stage" follows the text colour of the coloured home header. */
  tone?: "light" | "stage";
  /** Header background, used as the text colour of the selected option. */
  stage?: string;
}) {
  const root = useRef<HTMLDivElement>(null),
    thumb = useRef<HTMLSpanElement>(null),
    /* White text lives inside the thumb, so the labels read as one pill
       sliding over them instead of two backgrounds fading past each other. */
    labels = useRef<HTMLSpanElement>(null),
    placed = useRef("");
  const place = useCallback((animate: boolean, from?: RecommendScene) => {
    const container = root.current,
      indicator = thumb.current,
      overlay = labels.current;
    if (!container || !indicator || !overlay) return;
    const selected = container.querySelector<HTMLElement>(
      '[aria-checked="true"]',
    );
    if (!selected) return;
    const options = [
      ...container.querySelectorAll<HTMLElement>('[role="radio"]'),
    ];
    const faces = [
      ...overlay.querySelectorAll<HTMLElement>("[data-scene-label]"),
    ];
    // A fresh instance can be told to start where the pill used to be.
    const old = from
      ? options[recommendScenes.findIndex((scene) => scene.id === from)]
      : undefined;
    const target = old ?? selected;
    // Layout metrics, not getBoundingClientRect(): pressing a button scales it,
    // and a half-pressed label must not size or nudge the pill.
    const x = target.offsetLeft,
      y = target.offsetTop,
      width = target.offsetWidth,
      height = target.offsetHeight;
    if (!animate) {
      indicator.style.transition = "none";
      overlay.style.transition = "none";
    }
    indicator.style.width = `${width}px`;
    indicator.style.height = `${height}px`;
    indicator.style.transform = `translate3d(${x}px,${y}px,0)`;
    // The overlay moves opposite to the thumb, so its text holds still while
    // the thumb's clip slides over it.
    overlay.style.transform = `translate3d(${-x}px,${-y}px,0)`;
    options.forEach((option, index) => {
      const face = faces[index];
      if (!face) return;
      face.style.left = `${option.offsetLeft}px`;
      face.style.top = `${option.offsetTop}px`;
      face.style.width = `${option.offsetWidth}px`;
      face.style.height = `${option.offsetHeight}px`;
    });
    container.dataset.thumbReady = "true";
    placed.current = geometryOf(container);
    lastPlaced = recommendScenes[options.indexOf(selected)]?.id ?? null;
    if (!animate) {
      // Commit this position with transitions live, so a follow-up move starts
      // from here instead of from a frame that never got painted.
      indicator.style.transition = "";
      overlay.style.transition = "";
      indicator.getBoundingClientRect();
    }
  }, []);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!first.current) {
      place(true);
      return;
    }
    first.current = false;
    const from = lastPlaced && lastPlaced !== value ? lastPlaced : null;
    if (!from) {
      place(false);
      return;
    }
    place(false, from);
    place(true);
  }, [place, value]);
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let frame = 0;
    // A breakpoint can change the label size. Snap to the new geometry instead
    // of sliding across the screen; only a selection change is animated.
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // The observer's first report after a mount carries what we just
        // placed; re-placing would cut a move that is still in flight.
        if (geometryOf(container) === placed.current) return;
        place(false);
      });
    });
    observer.observe(container);
    container.querySelectorAll("button").forEach((el) => observer.observe(el));
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [place]);
  return (
    <div
      ref={root}
      role="radiogroup"
      aria-label="堂食还是外卖"
      className="ew-scene-toggle"
      data-tone={tone}
      style={
        stage ? ({ "--scene-toggle-on": stage } as CSSProperties) : undefined
      }
      onKeyDown={(event) => {
        if (
          ![
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
          ].includes(event.key)
        )
          return;
        const options = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[role="radio"]',
          ),
        ];
        const index = options.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (index < 0) return;
        event.preventDefault();
        const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? options.length - 1
              : (index + (forward ? 1 : -1) + options.length) % options.length;
        options[next].focus({ preventScroll: true });
        if (next !== index) onChange(recommendScenes[next].id);
      }}
    >
      <span ref={thumb} className="ew-scene-thumb" aria-hidden="true">
        <span ref={labels} className="ew-scene-thumb-labels">
          {recommendScenes.map((scene) => (
            <span key={scene.id} data-scene-label="">
              {scene.name}
            </span>
          ))}
        </span>
      </span>
      {recommendScenes.map((scene) => (
        <button
          key={scene.id}
          type="button"
          role="radio"
          aria-checked={value === scene.id}
          tabIndex={value === scene.id ? 0 : -1}
          onClick={() => value !== scene.id && onChange(scene.id)}
        >
          <span>{scene.name}</span>
        </button>
      ))}
    </div>
  );
}
