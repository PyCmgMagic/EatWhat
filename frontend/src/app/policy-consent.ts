import { BRAND_PREFIX } from "./brand";
import "./auth-dialog.css";
import "./policy-consent.css";

export type Policy = {
  version?: string | null;
  privacyText?: string | null;
  crossBorderText?: string | null;
};

let pending: Promise<boolean> | undefined;

/**
 * Backend v2 records policy consent at sign-in (and asks again when the policy
 * changes). The old pages never had that step, so show the current texts in a
 * dialog styled like the old login dialog and let the person decide.
 */
export function askPolicyConsent(policy: Policy, reason: "login" | "update") {
  pending ??= new Promise<boolean>((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "ew-login-dialog ew-policy-dialog";
    dialog.setAttribute("aria-labelledby", "ew-policy-title");
    const section = (title: string, text?: string | null) =>
      text?.trim()
        ? `<details class="ew-policy-text"><summary>${escape(title)}</summary><div>${escape(text)}</div></details>`
        : "";
    dialog.innerHTML = `
      <div class="ew-login-dialog-inner">
        <header class="ew-login-dialog-header">
          <span class="ew-login-dialog-brand">
            <span class="ew-login-dialog-mark" aria-hidden="true">✓</span>
            ${BRAND_PREFIX} <i aria-hidden="true">·</i> 今天吃什么
          </span>
        </header>
        <div class="ew-login-dialog-content">
          <div class="ew-auth-intro">
            <h2 id="ew-policy-title">${reason === "login" ? "登录前请阅读<span>隐私政策</span>" : "隐私政策<span>已更新</span>"}</h2>
            <p>${reason === "login" ? "同意后才能继续登录。" : "同意新版政策后才能继续使用。"}政策版本：${escape(policy.version ?? "—")}</p>
          </div>
          ${section("隐私政策", policy.privacyText)}
          ${section("个人信息出境说明", policy.crossBorderText)}
          <label class="ew-policy-check">
            <input type="checkbox" />
            <span>我已阅读并同意以上政策</span>
          </label>
          <div class="ew-policy-actions">
            <button type="button" data-choice="no">暂不同意</button>
            <button type="button" class="ew-auth-submit" data-choice="yes" disabled>同意并继续</button>
          </div>
        </div>
      </div>`;
    const check = dialog.querySelector<HTMLInputElement>("input")!;
    const agree = dialog.querySelector<HTMLButtonElement>("[data-choice=yes]")!;
    check.addEventListener("change", () => (agree.disabled = !check.checked));
    const finish = (value: boolean) => {
      dialog.close();
      dialog.remove();
      pending = undefined;
      resolve(value);
    };
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener("click", (event) => {
      const choice = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-choice]",
      )?.dataset.choice;
      if (choice) finish(choice === "yes");
    });
    document.body.append(dialog);
    dialog.showModal();
    check.focus();
  });
  return pending;
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
