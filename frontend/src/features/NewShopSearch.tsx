import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MapPlace } from "../api/baidu-places";
import { useArea } from "../app/area";
import { DesignIcon } from "../mobile/ui";
import { mapPoint } from "./map-geometry";
import "./new-shop-search.css";

export function NewShopSearch({
  keyword,
  onKeywordChange,
  onSelect,
  disabled,
}: {
  keyword: string;
  onKeywordChange: (value: string) => void;
  onSelect: (place?: MapPlace) => void;
  disabled?: boolean;
}) {
  const { area } = useArea();
  const input = useRef<HTMLInputElement>(null);
  const [composing, setComposing] = useState(false);
  const term = keyword.trim();
  const [settled, setSettled] = useState(term);
  const center = mapPoint(area);
  const activeTerm = composing || term !== settled ? "" : settled;
  const matches = useQuery({
    queryKey: ["new-shop-places", activeTerm, center?.gcjLng, center?.gcjLat],
    enabled: !!activeTerm && !disabled,
    queryFn: async ({ signal }) => {
      const { searchMapPlaces } = await import("../api/baidu-places");
      return searchMapPlaces(activeTerm, center, signal);
    },
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (composing || !term || term === settled) return;
    const timer = setTimeout(() => setSettled(term), 300);
    return () => clearTimeout(timer);
  }, [term, settled, composing]);

  function search() {
    if (!term || composing || matches.isFetching || disabled) return;
    if (term !== settled) setSettled(term);
    else void matches.refetch();
  }

  const places = activeTerm ? matches.data : undefined;
  const message =
    matches.isFetching || (!!term && !composing && term !== settled)
      ? "正在搜索…"
      : matches.isError
        ? "地图搜索暂不可用，请重试，或手动添加。"
        : places?.length === 0
          ? "没找到这家店，试试加上商圈或街道名。"
          : "";

  return (
    <div className="new-shop-search">
      <form
        className="new-shop-search-bar"
        role="search"
        aria-label="百度地图搜店"
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
      >
        <DesignIcon name="search" size={22} />
        <input
          ref={input}
          type="search"
          aria-label="搜索店名或地址"
          placeholder="搜店名或地址"
          value={keyword}
          maxLength={100}
          enterKeyHint="search"
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => onKeywordChange(event.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(event) => {
            onKeywordChange(event.currentTarget.value);
            setComposing(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            event.preventDefault();
            search();
          }}
        />
        {keyword && (
          <button
            type="button"
            className="new-shop-search-clear"
            aria-label="清空搜索"
            disabled={disabled}
            onClick={() => {
              onKeywordChange("");
              setSettled("");
              input.current?.focus();
            }}
          >
            <DesignIcon name="close" size={18} />
          </button>
        )}
        {term && (
          <button
            type="submit"
            className="new-shop-search-submit"
            disabled={disabled || composing || matches.isFetching}
          >
            {matches.isError ? "重试" : "搜索"}
          </button>
        )}
      </form>
      <p className="new-shop-search-status" role="status">
        {message}
      </p>
      {!!places?.length && (
        <ul className="restaurant-place-results" aria-label="百度地图搜索结果">
          {places.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(place)}
              >
                <span className="new-shop-result-pin">
                  <DesignIcon name="pin" size={19} />
                </span>
                <span className="new-shop-result-name">
                  <strong>{place.name}</strong>
                  {place.address && <small>{place.address}</small>}
                </span>
                <DesignIcon name="chevronRight" size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="new-shop-search-manual"
        disabled={disabled}
        onClick={() => onSelect()}
      >
        <span>
          <DesignIcon name="add" size={17} />
        </span>
        搜不到？手动添加
      </button>
    </div>
  );
}
