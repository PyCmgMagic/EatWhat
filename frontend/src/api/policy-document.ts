import DOMPurify from "dompurify";

const readableTags = [
  "main",
  "article",
  "section",
  "div",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "a",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "small",
  "sup",
  "sub",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "br",
  "hr",
  "blockquote",
  "code",
  "pre",
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
];

// Keep the official document's text and structure without importing executable
// markup, remote assets, or page-wide styles into the application.
export function readablePolicyHtml(html: string, url: string, version: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const source = document.querySelector("main, article") || document.body;
  const content = DOMPurify.sanitize(source.innerHTML, {
    ALLOWED_TAGS: readableTags,
    ALLOWED_ATTR: ["href", "title", "start", "colspan", "rowspan"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  const text = content.textContent?.trim();
  if (!text) throw new Error("政策正文为空，请重试或打开原文阅读。");
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (
    !version ||
    !new RegExp(
      `(^|[^a-zA-Z0-9._-])${escapedVersion}(?=$|[^a-zA-Z0-9._-])`,
    ).test(text)
  )
    throw new Error("政策正文与当前版本不一致，请刷新政策后重试。");
  const base = new URL(url, window.location.href);
  for (const link of content.querySelectorAll("a")) {
    const href = link.getAttribute("href");
    if (!href) continue;
    try {
      const target = new URL(href, base);
      if (!["https:", "http:", "mailto:", "tel:"].includes(target.protocol)) {
        link.removeAttribute("href");
        continue;
      }
      link.setAttribute("href", target.href);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    } catch {
      link.removeAttribute("href");
    }
  }
  const container = window.document.createElement("div");
  container.append(content);
  return container.innerHTML;
}

export async function loadPolicyDocument(
  url: string,
  version: string,
  signal?: AbortSignal,
) {
  const response = await fetch(url, {
    signal: AbortSignal.any(
      [signal, AbortSignal.timeout(15_000)].filter(
        (value): value is AbortSignal => !!value,
      ),
    ),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { Accept: "text/html" },
  });
  if (!response.ok)
    throw new Error(`政策正文加载失败（HTTP ${response.status}），请重试。`);
  if (
    !/^(text\/html|application\/xhtml\+xml)\b/i.test(
      response.headers.get("Content-Type") || "",
    )
  )
    throw new Error("正文地址未返回政策网页，请稍后重试。");
  return readablePolicyHtml(await response.text(), url, version);
}
