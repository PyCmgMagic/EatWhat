import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import "./search-field.css";

export function SearchField({
  defaultValue = "",
  className = "",
  onSearch,
}: {
  defaultValue?: string;
  className?: string;
  onSearch: (keyword: string) => void;
}) {
  const [query, setQuery] = useState(defaultValue);
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);

  return (
    <form
      className={`search-field ${className}`}
      role="search"
      aria-label="搜索菜品或店名"
      onSubmit={(event) => {
        event.preventDefault();
        if (!composing.current) {
          onSearch(query.trim());
          input.current?.blur();
        }
      }}
    >
      <Search size={20} aria-hidden="true" />
      <input
        ref={input}
        type="search"
        name="q"
        aria-label="搜索菜品或店名"
        placeholder="搜菜名或店名"
        value={query}
        maxLength={64}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(event) => setQuery(event.target.value)}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.nativeEvent.isComposing || event.keyCode === 229)
          )
            event.preventDefault();
        }}
      />
      {query && (
        <button
          type="button"
          className="search-field-clear"
          aria-label="清空搜索关键词"
          onClick={() => {
            setQuery("");
            input.current?.focus();
          }}
        >
          <X size={17} aria-hidden="true" />
        </button>
      )}
      <button type="submit" className="search-field-submit">
        搜索
      </button>
    </form>
  );
}
