import { useEffect, useId, useRef, type PointerEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { instantMotion, motion, trackMotion } from "../motion/runtime";

// Matching path commands let the paper bend without detaching from the corner.
const resting =
  "M0 0 C38 0 57 12 66 46 L104 178 L216 143 Q237 136 240 164 Q240 143 224 131 L61 17 Q35 0 0 0Z";
const lifted =
  "M0 0 C42 0 66 9 75 36 L118 158 L214 130 Q236 125 240 153 Q240 133 222 121 L66 13 Q37 0 0 0Z";
const settled =
  "M0 0 C37 0 55 13 64 48 L100 182 L217 147 Q237 140 240 167 Q240 146 225 134 L60 18 Q34 0 0 0Z";
const underResting = "M0 0 H240 V164 Q240 143 224 131 L61 17 Q35 0 0 0Z";
const underLifted = "M0 0 H240 V153 Q240 133 222 121 L66 13 Q37 0 0 0Z";
const underSettled = "M0 0 H240 V167 Q240 146 225 134 L60 18 Q34 0 0 0Z";

function PaperBend({ frames }: { frames: [string, string, string] }) {
  return (
    <animate
      attributeName="d"
      values={[...frames, frames[0], frames[0]].join(";")}
      keyTimes="0;.12;.21;.3;1"
      calcMode="spline"
      keySplines=".22 1 .36 1;.25 1 .5 1;.25 1 .5 1;0 0 1 1"
      dur="7s"
      repeatCount="indefinite"
    />
  );
}

type Pull = {
  id: number;
  target: Element;
  x: number;
  y: number;
  width: number;
  pressedAt: number;
  scaleX: number;
  scaleY: number;
  moved: boolean;
};

export function AuthPageCurl({ to }: { to: string }) {
  const id = useId();
  const navigate = useNavigate();
  const ref = useRef<SVGSVGElement>(null);
  const underside = useRef<SVGGElement>(null);
  const flap = useRef<SVGGElement>(null);
  const pupils = useRef<SVGGElement>(null);
  const pull = useRef<Pull | null>(null);
  const opening = useRef<Animation | null>(null);
  const blockClick = useRef(false);
  const syncIdle = useRef<(() => void) | null>(null);

  function startPull(event: PointerEvent<HTMLAnchorElement>) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      pull.current ||
      opening.current
    )
      return;
    blockClick.current = false;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
      return;
    const width = event.currentTarget.getBoundingClientRect().width;
    if (!width || !flap.current) return;
    // A new grab starts at the visible crease, even halfway through its rebound.
    const transform = getComputedStyle(flap.current).transform;
    const matrix =
      transform && transform !== "none"
        ? new DOMMatrixReadOnly(transform)
        : null;
    const target = event.target as Element;
    pull.current = {
      id: event.pointerId,
      target,
      x: event.clientX,
      y: event.clientY,
      width,
      pressedAt: event.timeStamp,
      scaleX: matrix?.a ?? 1,
      scaleY: matrix?.d ?? 1,
      moved: false,
    };
    event.currentTarget.dataset.pulling = "";
    flap.current.style.transform = transform;
    underside.current!.style.transform = transform;
    // Keep touch taps on their original painted target so the link receives its native click.
    target.setPointerCapture(event.pointerId);
    ref.current?.pauseAnimations?.();
  }

  function movePull(event: PointerEvent<HTMLAnchorElement>) {
    const start = pull.current;
    if (!start || start.id !== event.pointerId) return;
    const left = start.x - event.clientX;
    const down = event.clientY - start.y;
    if (!start.moved && Math.hypot(left, down) < 8) return;
    start.moved = true;
    // The tip sits 136 units left and 178 units below the fixed top-right corner.
    const unit = start.width / 240;
    const scaleX = Math.max(
      0.92,
      Math.min(1.85, start.scaleX + left / (136 * unit)),
    );
    const scaleY = Math.max(
      0.92,
      Math.min(1.85, start.scaleY + down / (178 * unit)),
    );
    const transform = `scale(${scaleX}, ${scaleY})`;
    underside.current!.style.transform = transform;
    flap.current!.style.transform = transform;
    pupils.current!.style.transform = `translate(${-4 * Math.tanh(left / 40)}px, ${3 * Math.tanh(down / 40)}px)`;
  }

  function finishPull(event: PointerEvent<HTMLAnchorElement>) {
    const start = pull.current;
    if (!start || start.id !== event.pointerId) return;
    const released = event.type === "pointerup";
    if (released) movePull(event);
    pull.current = null;
    blockClick.current = start.moved || !released;
    const link = event.currentTarget;
    function settle() {
      delete link.dataset.pulling;
      underside.current!.style.removeProperty("transform");
      flap.current!.style.removeProperty("transform");
      pupils.current!.style.removeProperty("transform");
      syncIdle.current?.();
    }
    const distance =
      (start.x - event.clientX + event.clientY - start.y) * Math.SQRT1_2;
    if (released && start.moved && distance >= start.width * 0.3) {
      // Finish the touch sequence on this link before replacing its page.
      const turn = trackMotion(
        ref.current!.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.12, 1.1)" }],
          { duration: instantMotion() ? 0 : motion.fast, easing: motion.move },
        ),
      );
      opening.current = turn;
      void turn.finished.then(
        () => {
          if (opening.current !== turn || !link.isConnected) return;
          opening.current = null;
          settle();
          navigate(to, { replace: true });
        },
        () => {},
      );
      return;
    }
    settle();
    // Touch browsers may omit the compatibility click after a captured drag.
    // Activate a fresh, brief tap exactly once; leave long presses to the browser.
    if (
      released &&
      !start.moved &&
      event.pointerType === "touch" &&
      event.timeStamp - start.pressedAt < 400
    ) {
      blockClick.current = true;
      requestAnimationFrame(() => {
        if (link.isConnected) link.click();
      });
    }
  }

  useEffect(() => {
    const paper = ref.current;
    if (!paper) return;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      if (motion?.matches) paper.setCurrentTime?.(0);
      if (
        visible &&
        !document.hidden &&
        !motion?.matches &&
        !pull.current &&
        !opening.current
      )
        paper.unpauseAnimations?.();
      else paper.pauseAnimations?.();
    };
    syncIdle.current = update;
    update();
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(paper);
    document.addEventListener("visibilitychange", update);
    motion?.addEventListener("change", update);
    return () => {
      syncIdle.current = null;
      opening.current?.cancel();
      opening.current = null;
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      motion?.removeEventListener("change", update);
    };
  }, []);

  return (
    <Link
      className="auth-landing-browse"
      to={to}
      replace
      draggable={false}
      onPointerDown={startPull}
      onPointerMove={movePull}
      onPointerUp={finishPull}
      onPointerCancel={finishPull}
      onLostPointerCapture={finishPull}
      onKeyDown={(event) => {
        const start = pull.current;
        if (
          event.key === "Escape" &&
          start &&
          start.target.hasPointerCapture(start.id)
        )
          start.target.releasePointerCapture(start.id);
      }}
      onClick={(event) => {
        if (event.detail !== 0 && blockClick.current) event.preventDefault();
      }}
    >
      <svg
        ref={ref}
        className="auth-page-curl"
        viewBox="0 0 240 190"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={`${id}-paper`}
            x1="93"
            y1="116"
            x2="124"
            y2="70"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fffdf6" />
            <stop offset=".56" stopColor="#fffefa" />
            <stop offset=".82" stopColor="#f9ebcc" />
            <stop offset="1" stopColor="#e5b75e" />
          </linearGradient>
          <linearGradient
            id={`${id}-edge`}
            x1="73"
            y1="50"
            x2="113"
            y2="164"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#c59136" />
            <stop offset="1" stopColor="#d9aa54" />
          </linearGradient>
        </defs>
        <g ref={underside} className="auth-page-curl-under">
          <path d={underResting} fill="white">
            <PaperBend frames={[underResting, underLifted, underSettled]} />
          </path>
        </g>
        <g className="auth-page-curl-eyes">
          <ellipse
            cx="207"
            cy="93"
            rx="10"
            ry="16"
            transform="rotate(-14 207 93)"
            fill="#fff"
            stroke="#e6e9e7"
            strokeWidth="1.5"
          />
          <ellipse
            cx="234"
            cy="87"
            rx="10"
            ry="16"
            transform="rotate(-14 234 87)"
            fill="#fff"
            stroke="#e6e9e7"
            strokeWidth="1.5"
          />
          <g ref={pupils} className="auth-page-curl-pupils" fill="#29343b">
            <ellipse cx="209" cy="97" rx="4.5" ry="6" />
            <ellipse cx="236" cy="91" rx="4.5" ry="6" />
            <circle cx="210" cy="95" r="1.8" fill="white" />
            <circle cx="237" cy="89" r="1.8" fill="white" />
          </g>
        </g>
        <g ref={flap} className="auth-page-curl-paper">
          <path
            d={resting}
            fill={`url(#${id}-edge)`}
            transform="translate(-3 4)"
          >
            <PaperBend frames={[resting, lifted, settled]} />
          </path>
          <path d={resting} fill={`url(#${id}-paper)`}>
            <PaperBend frames={[resting, lifted, settled]} />
          </path>
        </g>
      </svg>
      <span>先逛逛？</span>
    </Link>
  );
}
