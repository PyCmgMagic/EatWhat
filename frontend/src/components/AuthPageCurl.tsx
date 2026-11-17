import { useEffect, useId, useRef } from "react";

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

export function AuthPageCurl() {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const paper = ref.current;
    if (!paper) return;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      if (motion?.matches) paper.setCurrentTime?.(0);
      if (visible && !document.hidden && !motion?.matches)
        paper.unpauseAnimations?.();
      else paper.pauseAnimations?.();
    };
    update();
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(paper);
    document.addEventListener("visibilitychange", update);
    motion?.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      motion?.removeEventListener("change", update);
    };
  }, []);

  return (
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
      <path d={underResting} fill="white">
        <PaperBend frames={[underResting, underLifted, underSettled]} />
      </path>
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
        <g className="auth-page-curl-pupils" fill="#29343b">
          <ellipse cx="209" cy="97" rx="4.5" ry="6" />
          <ellipse cx="236" cy="91" rx="4.5" ry="6" />
          <circle cx="210" cy="95" r="1.8" fill="white" />
          <circle cx="237" cy="89" r="1.8" fill="white" />
        </g>
      </g>
      <g className="auth-page-curl-paper">
        <path d={resting} fill={`url(#${id}-edge)`} transform="translate(-3 4)">
          <PaperBend frames={[resting, lifted, settled]} />
        </path>
        <path d={resting} fill={`url(#${id}-paper)`}>
          <PaperBend frames={[resting, lifted, settled]} />
        </path>
      </g>
    </svg>
  );
}
