import { parseId } from "../api/models";

export type PeopleTab = "follow" | "fans";

export function peopleHref(pathname: string, search: string, tab: PeopleTab) {
  const path =
    pathname === "/me" || /^\/users\/\d+$/.test(pathname) ? pathname : "/me";
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
