import { boundedText, normalizedTag } from "../api/content-rules";

export function withDraftTag(names: string[], input: string) {
  const name = boundedText(normalizedTag(input), 10, "个人标签");
  const next = [...new Set(names.map(normalizedTag))];
  if (next.includes(name)) return next;
  if (next.length >= 20)
    throw new Error("最多添加 20 个个人标签，请先移除一个。");
  return [...next, name];
}

/** Commit a whole entry atomically, including pasted lists, without losing text on failure. */
export function withDraftTags(names: string[], input: string) {
  const entries = input
    .split(/[,，、\n]/u)
    .map(normalizedTag)
    .filter(Boolean);
  if (input.trim() && !entries.length) throw new Error("请填写个人标签内容。");
  return entries.reduce((next, name) => withDraftTag(next, name), [...names]);
}
