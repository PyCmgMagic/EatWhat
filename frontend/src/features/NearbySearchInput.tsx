import { useEffect, useRef, useState, type Ref } from "react";

export function NearbySearchInput({
  label,
  type = "text",
  value,
  onCommit,
  ref,
}: {
  label: string;
  type?: "text" | "search";
  value: string;
  onCommit: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
}) {
  const [composition, setComposition] = useState<string | null>(null);
  const composing = useRef(false);
  const committed = useRef(value);

  useEffect(() => {
    committed.current = value;
  }, [value]);

  function commit(next: string) {
    // A browser may also emit an input event for the committed composition.
    if (next === committed.current) return;
    committed.current = next;
    onCommit(next);
  }

  return (
    <input
      ref={ref}
      type={type}
      aria-label={label}
      placeholder="搜一家店"
      value={composition ?? value}
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      enterKeyHint="search"
      onCompositionStart={(event) => {
        composing.current = true;
        setComposition(event.currentTarget.value);
      }}
      onChange={(event) => {
        const next = event.currentTarget.value;
        if (composing.current) setComposition(next);
        else commit(next);
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        setComposition(null);
        commit(event.currentTarget.value);
      }}
    />
  );
}
