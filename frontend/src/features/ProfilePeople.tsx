import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { LoginLink } from "../app/auth-dialog";
import { mediaUrl, parseId } from "../api/models";
import { DesignIcon as Icon } from "../mobile/ui";
import { SlidingTabs, MotionRegion } from "../desktop/motion";
import { State } from "../desktop/secondary";
import {
  canReadPeople,
  legacyPeopleHref,
  peoplePage,
  type PeopleTab,
} from "./profile-people";
import { useExitPresence } from "../motion/hooks";
import "./profile-people.css";

/** Old bookmarks now open the same profile with its people panel. */
export function useLegacyPeopleRedirect() {
  const loc = useLocation(),
    nav = useNavigate(),
    { user, toast, me, session } = useApp();
  useLayoutEffect(() => {
    if (loc.pathname !== "/follows" || (session && me.isPending)) return;
    const destination = legacyPeopleHref(loc.search, user?.id);
    if (!destination) toast("食友编号无效，请从个人主页重新打开。");
    nav(destination ?? "/me", { replace: true });
  }, [loc.pathname, loc.search, nav, user?.id, toast, me.isPending, session]);
}

/** Mounted outside both layouts so a native modal can preserve the profile below. */
export function ProfilePeopleDialog() {
  const loc = useLocation(),
    nav = useNavigate(),
    { api, user, session, me } = useApp();
  const params = new URLSearchParams(loc.search),
    selected = params.get("people");
  const isProfile =
    loc.pathname === "/me" || /^\/users\/\d+$/.test(loc.pathname);
  const open = isProfile && (selected === "follow" || selected === "fans");
  const presence = useExitPresence(open ? loc.pathname + loc.search : null);
  const viewPath = presence.value?.split("?")[0] ?? loc.pathname;
  const viewParams = new URLSearchParams(
    presence.value?.split("?")[1] ?? loc.search,
  );
  const tab: PeopleTab =
    viewParams.get("people") === "fans" ? "fans" : "follow";
  const id =
    viewPath === "/me"
      ? (user?.id ?? undefined)
      : parseId(viewPath.split("/").pop());
  const own = viewPath === "/me" || (!!id && id === user?.id);
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId();
  const profile = useQuery({
    queryKey: ["user", id],
    queryFn: () => api.otherUser(id!),
    enabled: open && !!session && !!user && !user.banned && !!id,
  });
  const visible =
    tab === "fans"
      ? profile.data?.fansVisible
      : profile.data?.followingsVisible;
  const allowed =
    !!presence.value &&
    canReadPeople({
      authenticated: !!session,
      banned: user?.banned,
      ownerId: id,
      accountId: user?.id,
      profileReady: profile.isSuccess,
      visible,
    });
  const name = own ? user?.displayName : profile.data?.displayName;
  const avatar = mediaUrl(own ? user?.avatar : profile.data?.avatar);
  const page = peoplePage(viewParams.get("peoplePage")),
    search = viewParams.get("peopleQ") ?? "";
  const query = useQuery({
    queryKey: ["social", tab === "fans" ? "followers" : "followings", id, page],
    queryFn: () =>
      api.followers(tab === "fans" ? "followers" : "followings", id, page),
    enabled: open && allowed,
    // Do not carry another person's or another tab's cached rows across privacy gates.
  });
  const rows = query.data?.items ?? [],
    shown = rows.filter((row) =>
      (row.displayName ?? "")
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    );

  function change(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(loc.search);
    for (const [key, value] of Object.entries(patch))
      value ? next.set(key, value) : next.delete(key);
    nav(
      { pathname: loc.pathname, search: `?${next}` },
      { replace: true, state: loc.state, preventScrollReset: true },
    );
  }
  function close() {
    dialog.current?.close();
  }
  function closed() {
    if (!open || dialog.current?.open) return;
    if (
      typeof loc.state?.profilePeopleFrom === "string" &&
      (window.history.state?.idx ?? 0) > 0
    )
      nav(-1);
    else {
      const next = new URLSearchParams(loc.search);
      for (const key of ["people", "peoplePage", "peopleQ"]) next.delete(key);
      nav(
        { pathname: loc.pathname, search: next.toString() ? `?${next}` : "" },
        { replace: true, state: null, preventScrollReset: true },
      );
    }
  }
  useLayoutEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    else if (!open && element?.open) element.close();
  }, [open]);
  useEffect(() => {
    if (!presence.value) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [!!presence.value]);

  let content;
  if (!session)
    content = (
      <State title="登录后，认识更多食友" detail="登录后可以查看关注与粉丝。">
        <LoginLink
          className="pc-button"
          to={`/auth/password?next=${encodeURIComponent(loc.pathname + loc.search)}`}
        >
          去登录
        </LoginLink>
      </State>
    );
  else if (
    me.isPending ||
    (!own && profile.isPending && !!id && !!user && !user.banned)
  )
    content = <State loading />;
  else if (me.isError)
    content = <State error={me.error} retry={() => void me.refetch()} />;
  else if (user?.banned)
    content = (
      <State title="账号暂时无法使用" detail="请联系平台管理员了解账号状态。" />
    );
  else if (!id)
    content = (
      <State title="食友编号无效" detail="请关闭列表，从个人主页重新打开。" />
    );
  else if (!own && profile.isError)
    content = (
      <State error={profile.error} retry={() => void profile.refetch()} />
    );
  else if (!allowed)
    content = (
      <State
        title={
          visible === false ? "对方没有公开这个列表" : "暂时无法确认公开范围"
        }
        detail="公开范围由这位食友的隐私设置决定。"
      />
    );
  else if (query.isPending || query.isError)
    content = (
      <State
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
    );
  else if (!shown.length)
    content = (
      <State
        title={
          search
            ? "本页没有找到这位食友"
            : tab === "fans"
              ? "还没有粉丝"
              : "还没有关注的食友"
        }
        detail={
          search
            ? "试试其他名字，或清除搜索查看本页全部食友。"
            : own
              ? "遇到喜欢的分享，去食友主页认识一下吧。"
              : "先看看这位食友的其他公开资料。"
        }
      >
        {search && (
          <button
            className="pc-button light"
            onClick={() => change({ peopleQ: undefined })}
          >
            清除搜索
          </button>
        )}
      </State>
    );
  else
    content = (
      <div className="profile-people-grid">
        {shown.map((row, index) => {
          const personId = parseId(String(row.id ?? "")),
            personName = row.displayName || "校园食友",
            picture = mediaUrl(row.avatar);
          const body = (
            <>
              <span className="profile-people-avatar">
                {picture ? (
                  <img src={picture} alt="" />
                ) : (
                  personName.slice(0, 1)
                )}
              </span>
              <span className="profile-people-person">
                <strong title={personName}>{personName}</strong>
                <small>{personId ? "查看食友主页" : "资料暂不可用"}</small>
              </span>
              {personId && <Icon name="chevronRight" size={17} />}
            </>
          );
          return personId ? (
            <Link
              className="profile-people-person-row"
              key={personId}
              to={personId === user?.id ? "/me" : `/users/${personId}`}
              aria-label={`查看${personName}的主页`}
            >
              {body}
            </Link>
          ) : (
            <div
              className="profile-people-person-row unavailable"
              key={`unavailable-${index}`}
            >
              {body}
            </div>
          );
        })}
      </div>
    );

  return createPortal(
    <dialog
      ref={dialog}
      className="profile-people-dialog"
      aria-labelledby={titleId}
      aria-label={own ? "关注与粉丝" : "TA 的关注与粉丝"}
      aria-modal="true"
      onClose={closed}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="profile-people-shell">
        <span className="profile-people-handle" aria-hidden="true" />
        <header className="profile-people-heading">
          <span className="profile-people-avatar owner">
            {avatar ? <img src={avatar} alt="" /> : name?.slice(0, 1) || "食"}
          </span>
          <div>
            <span className="profile-people-eyebrow">
              {own ? "我的校园食友圈" : name || "校园食友"}
            </span>
            <h2 id={titleId}>{own ? "关注与粉丝" : "TA 的关注与粉丝"}</h2>
          </div>
          <button
            type="button"
            className="profile-people-close"
            aria-label="关闭关注与粉丝"
            onClick={close}
          >
            <Icon name="close" size={22} />
          </button>
        </header>
        <div className="profile-people-toolbar">
          <SlidingTabs active={tab} label="关注与粉丝">
            {(["follow", "fans"] as const).map((kind) => {
              const permitted =
                own ||
                (kind === "fans"
                  ? profile.data?.fansVisible
                  : profile.data?.followingsVisible) === true;
              const total =
                kind === "fans"
                  ? profile.data?.fansCount
                  : profile.data?.followingsCount;
              return (
                <button
                  type="button"
                  key={kind}
                  role="tab"
                  aria-selected={tab === kind}
                  tabIndex={tab === kind ? 0 : -1}
                  aria-controls={titleId + "-list"}
                  onClick={() =>
                    change({
                      people: kind,
                      peoplePage: undefined,
                      peopleQ: undefined,
                    })
                  }
                >
                  {kind === "fans" ? "粉丝" : "关注"}
                  <span>
                    {permitted ? (
                      ((kind === tab ? query.data?.totalItems : undefined) ??
                      total ??
                      "—")
                    ) : (
                      <Icon name="lock" size={12} />
                    )}
                  </span>
                </button>
              );
            })}
          </SlidingTabs>
          <label className="profile-people-search">
            <Icon name="search" size={16} />
            <input
              aria-label="搜索本页食友"
              placeholder="搜索本页食友"
              value={search}
              disabled={!allowed || query.isPending}
              onChange={(e) => change({ peopleQ: e.target.value || undefined })}
            />
          </label>
        </div>
        <div className="profile-people-scroll" key={`${id}:${tab}:${page}`}>
          <MotionRegion
            id={titleId + "-list"}
            role="tabpanel"
            aria-label={tab === "fans" ? "粉丝列表" : "关注列表"}
            changeKey={
              open ? `${id}:${tab}:${page}:${query.dataUpdatedAt}` : undefined
            }
            order={tab === "fans" ? 1 : 0}
            className="profile-people-results"
          >
            {content}
          </MotionRegion>
        </div>
        <footer className="profile-people-footer">
          <span>
            {own ? (
              <Link to="/settings/privacy">
                <Icon name="lock" size={13} />
                列表可见性设置
                <Icon name="chevronRight" size={13} />
              </Link>
            ) : (
              "仅展示这位食友公开的列表"
            )}
          </span>
          {allowed && (page > 1 || query.data?.hasNext) && (
            <nav aria-label="食友分页">
              <button
                type="button"
                aria-label="上一页食友"
                disabled={page <= 1 || query.isFetching}
                onClick={() =>
                  change({
                    peoplePage: page > 2 ? String(page - 1) : undefined,
                    peopleQ: undefined,
                  })
                }
              >
                <Icon name="back" size={17} />
              </button>
              <span>第 {page} 页</span>
              <button
                type="button"
                aria-label="下一页食友"
                disabled={!query.data?.hasNext || query.isFetching}
                onClick={() =>
                  change({ peoplePage: String(page + 1), peopleQ: undefined })
                }
              >
                <Icon name="chevronRight" size={17} />
              </button>
            </nav>
          )}
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
