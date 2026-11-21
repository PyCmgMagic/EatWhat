import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { LoginLink } from "../app/auth-dialog";
import { useReturnTo } from "../app/navigation";
import { errorMessage, resultUncertain } from "../api/client";
import { restaurantEditBody } from "../api/content-rules";
import { parseId, type Restaurant } from "../api/models";
import { useFeedbackState } from "../components/feedback";
import { FeaturePage, FeatureState } from "./Catalog";
import { ShopTraitsFields, shopTraitsOf, type ShopTraits } from "./ShopTraits";
import "./latest.css";
import "./shop-edit.css";

export const shopEditPath = (id: number) => `/restaurants/${id}/edit`;
export const isShopEditPath = (path: string) =>
  /^\/restaurants\/\d+\/edit$/.test(path);

/**
 * Shops are edited openly (like dishes): any verified user may fix a shop's
 * name, address and traits such as its meal times. Every save becomes an
 * entry in the shop's public edit history and can be restored.
 */
export function EditRestaurant() {
  const { api, session, user } = useApp(),
    loc = useLocation(),
    id = parseId(loc.pathname.match(/^\/restaurants\/(\d+)\/edit$/)?.[1]),
    q = useQuery({
      queryKey: ["restaurants", "detail", id],
      queryFn: () => api.restaurant(id!),
      enabled: !!id && !!session,
    });
  const detailPath = id ? `/restaurants/${id}` : "/restaurants";
  const back = useReturnTo(detailPath);
  if (!session)
    return (
      <FeaturePage title="修改店铺" back={back}>
        <LoginLink
          className="ew-button"
          to={"/auth/password?next=" + encodeURIComponent(loc.pathname)}
        >
          登录后修改
        </LoginLink>
      </FeaturePage>
    );
  if (!user?.verified || user.banned)
    return (
      <FeaturePage title="修改店铺" back={back}>
        <FeatureState empty="完成学生认证后，可以修改店铺信息" />
        <Link className="ew-button" to="/verify">
          查看认证状态
        </Link>
      </FeaturePage>
    );
  if (!id)
    return (
      <FeaturePage title="修改店铺" back={back}>
        <FeatureState empty="店铺编号无效" />
      </FeaturePage>
    );
  return (
    <FeaturePage title="修改店铺" back={back}>
      {q.isPending || q.isError ? (
        <FeatureState
          loading={q.isPending}
          error={q.error}
          retry={() => void q.refetch()}
        />
      ) : (
        <EditForm key={id} shop={q.data} back={back} detailPath={detailPath} />
      )}
    </FeaturePage>
  );
}

function EditForm({
  shop,
  back,
  detailPath,
}: {
  shop: Restaurant;
  back: string;
  detailPath: string;
}) {
  const { api, toast } = useApp(),
    nav = useNavigate(),
    cache = useQueryClient(),
    locked = useRef(false),
    original = shopTraitsOf(shop as Restaurant & Partial<ShopTraits>),
    [name, setName] = useState(shop.name ?? ""),
    [address, setAddress] = useState(shop.address ?? ""),
    [traits, setTraits] = useState<ShopTraits>(original),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    // Errors are shown as toasts by useFeedbackState.
    [, setError] = useFeedbackState();
  const traitsChanged = JSON.stringify(traits) !== JSON.stringify(original);
  const dirty =
    name.trim() !== (shop.name ?? "").trim() ||
    address.trim() !== (shop.address ?? "").trim() ||
    traitsChanged;
  return (
    <form
      className="ew-edit-form ew-form-panel ew-shop-edit"
      onSubmit={async (e) => {
        e.preventDefault();
        if (locked.current || uncertain || !dirty) return;
        locked.current = true;
        setBusy(true);
        setError("");
        try {
          if (!name.trim() || !address.trim())
            throw new Error("请填写店名和地址。");
          if (!traits.mealTimes.length)
            throw new Error("请至少选择一个营业饭点。");
          await api.editRestaurant(shop.id!, {
            ...restaurantEditBody(shop, { name, address }),
            ...(traitsChanged ? traits : {}),
          });
          await cache.invalidateQueries({ queryKey: ["restaurants"] });
          await cache.invalidateQueries({ queryKey: ["foods"] });
          toast("店铺信息已更新");
          nav(detailPath);
        } catch (err) {
          setError(errorMessage(err));
          if (resultUncertain(err)) setUncertain(true);
        } finally {
          locked.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset className="shop-edit-fields" disabled={busy || uncertain}>
        <section className="shop-edit-basics" aria-label="基本信息">
          <label>
            店名
            <input
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            地址
            <textarea
              value={address}
              rows={2}
              autoComplete="street-address"
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </label>
        </section>
        <ShopTraitsFields value={traits} onChange={setTraits} compact />
        <details className="shop-edit-notice">
          <summary>修改记录公开</summary>
          <p>
            修改记录对所有人可见，支持恢复到历史版本。位置有误请用店铺详情中的“信息有误”反馈。
          </p>
        </details>
      </fieldset>
      {uncertain && (
        <p className="ew-error">
          保存结果尚未确认，请返回店铺详情核实后再继续。
        </p>
      )}
      <footer className="ew-inline shop-edit-actions">
        <Link to={back}>返回店铺</Link>
        <button className="ew-button" disabled={busy || uncertain || !dirty}>
          {busy ? "正在保存…" : "保存修改"}
        </button>
      </footer>
    </form>
  );
}
