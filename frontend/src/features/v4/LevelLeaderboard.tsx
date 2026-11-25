import { useContext, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { type LevelLeaderboardEntry, userTitle } from "../../api/growth";
import { mediaUrl, parseId } from "../../api/models";
import { ProfileWorkspaceContext } from "../../app/profile-workspace";
import { useApp } from "../../app/state";
import { UserAvatar } from "../../components/UserAvatar";
import { DesignIcon as Icon } from "../../mobile/ui";
import { QueryView, Shell } from "./shared";
import "./level-leaderboard.css";

const title = "等级排行榜";
const detail = "前 50 名 · 按累计经验排名";
const growthPath = "/me/growth";
const cover = "/assets/leaderboard/cover.webp";
type RankedMember = LevelLeaderboardEntry & { id: number; rank: number };

function rankedMember(entry: LevelLeaderboardEntry): entry is RankedMember {
  return (
    entry != null &&
    Number.isSafeInteger(entry.id) &&
    (entry.id ?? 0) > 0 &&
    Number.isInteger(entry.rank) &&
    (entry.rank ?? 0) > 0 &&
    (entry.rank ?? 0) <= 50
  );
}

function Person({
  member,
  own,
  showLevel = false,
}: {
  member: RankedMember;
  own: boolean;
  showLevel?: boolean;
}) {
  const name = member.displayName?.trim() || "校园食友";
  const equippedTitle = userTitle(member);
  return (
    <Link className="level-board-person" to={`/users/${member.id}`}>
      <UserAvatar
        className="level-board-avatar"
        avatar={member.avatar}
        name={name}
      />
      <span className="level-board-identity">
        <strong>{name}</strong>
        <span className="level-board-person-meta">
          {showLevel && <span>Lv.{member.level ?? "—"}</span>}
          {equippedTitle && <span>{equippedTitle}</span>}
          {own && <span className="level-board-self">我</span>}
        </span>
      </span>
    </Link>
  );
}

function PodiumDish({
  member,
  enabled,
}: {
  member: RankedMember;
  enabled: boolean;
}) {
  const { api, user } = useApp();
  const [failedSource, setFailedSource] = useState<string>();
  const { data } = useQuery({
    queryKey: ["growth", user?.id, "leaderboard", "dish", member.id],
    queryFn: ({ signal }) =>
      api.userFoods(member.id, 1, { pageSize: 1 }, signal),
    enabled: enabled && !!user?.id,
    retry: false,
  });
  const dish = enabled ? data?.items?.[0] : undefined;
  const name = dish?.name?.trim();
  const id = parseId(String(dish?.id));
  const src = mediaUrl(dish?.pictureUrl?.[0]);
  if (id && name && src && src !== failedSource) {
    return (
      <Link className="level-board-dish" to={`/foods/${id}`}>
        <img
          src={src}
          alt=""
          decoding="async"
          onError={() => setFailedSource(src)}
        />
        <span>{name}</span>
      </Link>
    );
  }
  return member.rank === 1 ? (
    <div className="level-board-dish level-board-cover" aria-hidden="true">
      <img src={cover} alt="" decoding="async" />
    </div>
  ) : null;
}

export default function LevelLeaderboard() {
  const { api, user } = useApp();
  const desktop = useContext(ProfileWorkspaceContext);
  const ownRow = useRef<HTMLElement | null>(null);
  const ranking = useQuery({
    queryKey: ["growth", user?.id, "leaderboard"],
    queryFn: ({ signal }) => api.levelLeaderboard(signal),
    enabled: !!user?.id,
  });
  const members = (Array.isArray(ranking.data) ? ranking.data : [])
    .filter(rankedMember)
    .sort((a, b) => a.rank - b.rank);
  const podium = members.filter((member) => member.rank <= 3);
  const rest = members.filter((member) => member.rank > 3);
  const mine = members.find((member) => member.id === user?.id);
  const selfRank = mine ? (
    <button
      className="level-board-my-rank"
      type="button"
      onClick={() => {
        ownRow.current?.focus({ preventScroll: true });
        ownRow.current?.scrollIntoView({
          block: "center",
          behavior: "instant",
        });
      }}
    >
      <span>我的名次</span>
      <strong>第 {mine.rank} 名</strong>
      <Icon name="chevronDown" size={15} />
    </button>
  ) : members.length ? (
    <span className="level-board-unranked">未进入前 50 名</span>
  ) : null;
  const heading = desktop ? (
    <header className="v4-heading level-board-heading">
      <div className="v4-page-title">
        <div>
          <h1>{title}</h1>
          <p>{detail}</p>
        </div>
      </div>
      <div className="level-board-actions">
        {selfRank}
        <Link className="level-board-back" to={growthPath}>
          <Icon name="back" size={15} />
          返回成长
        </Link>
      </div>
    </header>
  ) : undefined;

  function setOwnRow(element: HTMLElement | null) {
    ownRow.current = element;
  }

  return (
    <Shell
      title={title}
      detail={detail}
      heading={heading}
      back={growthPath}
      advice={false}
    >
      <QueryView
        query={ranking}
        empty={members.length === 0}
        emptyTitle="暂时没有上榜食友"
        emptyDetail=""
        emptyIllustration="baozi"
      >
        <div
          className={
            desktop ? "level-board level-board-desktop" : "level-board"
          }
        >
          <ol className="level-board-podium" aria-label="前三名" role="list">
            {podium.map((member) => {
              const own = member.id === mine?.id;
              return (
                <li
                  key={member.id}
                  className="level-board-place"
                  data-rank={member.rank}
                  data-own={own || undefined}
                  ref={own ? setOwnRow : undefined}
                  tabIndex={own ? -1 : undefined}
                >
                  <span className="level-board-rank">
                    <span className="sr-only">第 {member.rank} 名</span>
                    <span aria-hidden="true">
                      {desktop
                        ? String(member.rank).padStart(2, "0")
                        : member.rank === 1
                          ? "第 1 名"
                          : member.rank}
                    </span>
                  </span>
                  <Person member={member} own={own} showLevel />
                  <PodiumDish
                    member={member}
                    enabled={desktop || member.rank === 1}
                  />
                </li>
              );
            })}
          </ol>
          {!desktop && selfRank}
          {rest.length > 0 && (
            <table className="level-board-table" aria-label="第 4 至 50 名">
              <colgroup>
                <col className="level-board-rank-column" />
                <col />
                <col className="level-board-level-column" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">名次</th>
                  <th scope="col">食友</th>
                  <th scope="col">等级</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((member) => {
                  const own = member.id === mine?.id;
                  return (
                    <tr
                      key={member.id}
                      data-own={own || undefined}
                      ref={own ? setOwnRow : undefined}
                      tabIndex={own ? -1 : undefined}
                    >
                      <td className="level-board-rank">
                        {desktop
                          ? String(member.rank).padStart(2, "0")
                          : member.rank}
                      </td>
                      <td>
                        <Person member={member} own={own} />
                      </td>
                      <td className="level-board-level">
                        Lv.{member.level ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </QueryView>
    </Shell>
  );
}
