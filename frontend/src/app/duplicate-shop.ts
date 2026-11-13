import "./auth-dialog.css";
import "./policy-consent.css";

export type DuplicateShop = {
  id: number;
  name?: string | null;
  address?: string | null;
  distanceMeters?: number | null;
  permanentlyClosed?: boolean | null;
  reason?: string | null;
};
/** The shop the person chose instead, "new" to add anyway, null to go back. */
export type DuplicateChoice = { id: number } | "new" | null;

const distance = (m?: number | null) =>
  m == null
    ? ""
    : m < 1000
      ? `${Math.round(m)} 米`
      : `${(m / 1000).toFixed(1)} 公里`;

/**
 * Backend v2 answers 40017 when the same map place or a same-named shop nearby
 * already exists. Show those shops in the old login dialog's style so the
 * person can pick one or still add a new shop.
 */
export function askDuplicateShop(
  shops: DuplicateShop[],
  message?: string,
): Promise<DuplicateChoice> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "ew-login-dialog ew-policy-dialog ew-duplicate-dialog";
    dialog.setAttribute("aria-labelledby", "ew-duplicate-title");
    const samePlace = shops.some((s) => s.reason === "poi");
    const rows = shops
      .map((s) => {
        const meta = [
          s.reason === "poi" ? "同一地点" : "附近同名",
          distance(s.distanceMeters),
          s.permanentlyClosed ? "已停业" : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return `<li><button type="button" data-shop="${s.id}">
            <b>${escape(s.name ?? "未命名店铺")}</b>
            <span>${escape(s.address ?? "")}</span>
            <small>${escape(meta)}</small>
          </button></li>`;
      })
      .join("");
    dialog.innerHTML = `
      <div class="ew-login-dialog-inner">
        <header class="ew-login-dialog-header">
          <span class="ew-login-dialog-brand">
            <span class="ew-login-dialog-mark" aria-hidden="true">?</span>
            山软 <i aria-hidden="true">·</i> 今天吃什么
          </span>
        </header>
        <div class="ew-login-dialog-content">
          <div class="ew-auth-intro">
            <h2 id="ew-duplicate-title">${escape(message || "这家店可能已经有了")}</h2>
            <p>${samePlace ? "这个地点已经登记过店铺。" : "附近有同名的店铺。"}如果是同一家，直接选它就好。</p>
          </div>
          <ul class="ew-duplicate-list">${rows}</ul>
          <div class="ew-policy-actions">
            <button type="button" data-choice="back">返回修改</button>
            <button type="button" class="ew-auth-submit" data-choice="new">不是，仍然新建</button>
          </div>
        </div>
      </div>`;
    const finish = (value: DuplicateChoice) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const shop = target.closest<HTMLElement>("[data-shop]")?.dataset.shop;
      if (shop) return finish({ id: Number(shop) });
      const choice =
        target.closest<HTMLElement>("[data-choice]")?.dataset.choice;
      if (choice) finish(choice === "new" ? "new" : null);
    });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-shop]")?.focus();
  });
}

function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
