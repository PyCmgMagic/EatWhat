import { parseId } from "../api/models";
import { profileSection } from "../app/profile-workspace";

export type PeopleTab = "follow" | "fans";

export function followLabel(person: {
  isFollowingHim?: boolean | null;
  isFollowingMe?: boolean | null;
}) {
  if (person.isFollowingHim) return person.isFollowingMe ? "已互关" : "已关注";
  return person.isFollowingMe ? "回关" : "关注";
}

const otherProfilePath = /^\/users\/\d+$/;

/**
 * 关注/粉丝面板的宿主：个人工作台里的任意一页（含设置子页），或别人的主页。
 * 面板浮在当前页面之上，关掉后仍停在原来那个标签页。
 */
export function isPeopleHost(pathname: string) {
  return otherProfilePath.test(pathname) || profileSection(pathname) !== null;
}

export function peopleHref(pathname: string, search: string, tab: PeopleTab) {
  const path = isPeopleHost(pathname) ? pathname : "/me";
  const params = new URLSearchParams(search);
  params.set("people", tab);
  params.delete("peoplePage");
  params.delete("peopleQ");
  return `${path}?${params}`;
}

export function legacyPeopleHref(search: string, ownId?: number | null) {
  const params = new URLSearchParams(search),
    raw = params.get("userId");
  const id = raw !== null && /^\d+$/.test(raw) ? parseId(raw) : undefined;
  if (raw !== null && !id) return undefined;
  return peopleHref(
    id && id !== ownId ? `/users/${id}` : "/me",
    "",
    params.get("tab") === "fans" ? "fans" : "follow",
  );
}

export function peoplePage(raw: string | null) {
  const page = raw && /^\d+$/.test(raw) ? Number(raw) : 1;
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function canReadPeople({
  authenticated,
  banned,
  ownerId,
  accountId,
  profileReady,
  visible,
}: {
  authenticated: boolean;
  banned?: boolean | null;
  ownerId?: number;
  accountId?: number | null;
  profileReady: boolean;
  visible?: boolean | null;
}) {
  return (
    authenticated &&
    !banned &&
    !!ownerId &&
    !!accountId &&
    (ownerId === accountId || (profileReady && visible === true))
  );
}
