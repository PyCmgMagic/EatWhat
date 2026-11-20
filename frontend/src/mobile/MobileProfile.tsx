import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  Clock3,
  Heart,
  Settings,
  SquarePen,
  Upload,
} from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import WorkspaceSwitch from "../admin/WorkspaceSwitch";
import { errorMessage } from "../api/client";
import { mediaUrl, parseId } from "../api/models";
import { ProfileEditLink } from "../app/profile-navigation";
import { isDemo } from "../app/runtime";
import { useApp } from "../app/state";
import { FoodCover } from "../components/FoodCover";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { MarkerTabs } from "../components/MarkerTabs";
import { MobileHistoryContent } from "../features/ApiV2";
import { UserAvatar } from "../components/UserAvatar";
import { useFoodPhoto } from "../features/media";
import { peopleHref } from "../features/profile-people";
import ProfileGrowth from "../features/ProfileGrowth";
import { useMyProfileCover } from "../features/useMyProfileCover";
import { visualFor } from "./catalog";
import ProfileSheet from "./ProfileSheet";
import { FoodTile, MobileEmpty, PrimaryButton } from "./ui";

const profileTabs = [
  { id: "uploads", name: "上传", icon: Upload },
  { id: "favorites", name: "收藏", icon: Bookmark },
  { id: "likes", name: "赞过", icon: Heart },
  { id: "history", name: "足迹", icon: Clock3 },
] as const;
type ProfileTab = (typeof profileTabs)[number]["id"];
const emptyTitles = {
  uploads: "还没有分享过菜",
  favorites: "还没有收藏的菜",
  likes: "还没有赞过的菜",
};

function ProfileFoods({
  tab,
  page,
  onPage,
}: {
  tab: Exclude<ProfileTab, "history">;
  page: number;
  onPage: (page: number) => void;
}) {
  const { api } = useApp();
  const query = useQuery({
    queryKey:
      tab === "favorites"
        ? ["foods", "favorites", page, null]
        : ["foods", tab === "uploads" ? "mine" : "likes", page],
    queryFn: () =>
      tab === "uploads"
        ? api.myFoods(page)
        : tab === "likes"
          ? api.likedFoods(page)
          : api.favorites(page),
  });
  return (
    <>
      {tab !== "uploads" && (
        <Link
          className="mobile-profile-manage"
          to={tab === "favorites" ? "/favorites" : "/likes"}
        >
          {tab === "favorites" ? "管理收藏" : "管理点赞"}
        </Link>
      )}
      {query.isPending ? (
        <ContentSkeleton kind="cards" count={2} />
      ) : query.isError ? (
        <MobileEmpty
          title="暂时没能加载这些菜"
          detail={errorMessage(query.error)}
          action={
            <PrimaryButton light onClick={() => void query.refetch()}>
              重新加载
            </PrimaryButton>
          }
        />
      ) : query.data.items?.length ? (
        <div className="design-food-grid mobile-data-grid">
          {query.data.items.map((food) => (
            <FoodTile
              key={food.id}
              food={food}
              meta="profile"
              visual={visualFor(food, isDemo)}
            />
          ))}
        </div>
      ) : (
        <MobileEmpty
          title={emptyTitles[tab]}
          illustration={tab === "uploads" ? "yuntun" : "yangzhi"}
          action={
            <Link
              className="design-button light"
              to={tab === "uploads" ? "/publish" : "/"}
            >
              {tab === "uploads" ? "分享一道菜" : "去发现"}
            </Link>
          }
        />
      )}
      {(page > 1 || query.data?.hasNext) && (
        <div className="mobile-page-more">
          {page > 1 && (
            <PrimaryButton light onClick={() => onPage(page - 1)}>
              上一页
            </PrimaryButton>
          )}
          {query.data?.hasNext && (
            <PrimaryButton light onClick={() => onPage(page + 1)}>
              下一页
            </PrimaryButton>
          )}
        </div>
      )}
    </>
  );
}

export default function MobileProfile() {
  const { api, user } = useApp();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab =
    profileTabs.find(({ id }) => id === params.get("tab"))?.id ?? "uploads";
  const page = parseId(params.get("page") ?? undefined) ?? 1;
  const panelId = useId();
  const personal = useQuery({
    queryKey: ["user", user?.id],
    queryFn: () => api.otherUser(user!.id!),
    enabled: !!user?.id,
  });
  const { cover, fallback, uploadCount } = useMyProfileCover(!!user?.id);
  const src = mediaUrl(cover.pictureUrl?.[0]);
  const photo = useFoodPhoto(src);
  const illustration = cover === fallback || photo.unavailable;
  const name = user?.displayName || "同学";
  const uploads = personal.data?.uploadedFoodsCount ?? uploadCount;
  const stats = [
    { label: "获赞", value: personal.data?.earnedLikes },
    { label: "上传的菜", value: uploads },
    {
      label: "粉丝",
      value: personal.data?.fansCount,
      to: peopleHref(location.pathname, location.search, "fans"),
    },
    {
      label: "关注",
      value: personal.data?.followingsCount,
      to: peopleHref(location.pathname, location.search, "follow"),
    },
  ];
  function select(next: ProfileTab, nextPage = 1) {
    const search = new URLSearchParams(params);
    search.set("tab", next);
    if (next !== "history") search.delete("historyKind");
    if (nextPage === 1) search.delete("page");
    else search.set("page", String(nextPage));
    setParams(search, {
      replace: true,
      state: { ...location.state, preserveScroll: true },
    });
  }
  return (
    <div className="design-screen mobile-profile-screen" data-screen="G-Me">
      <div className="mobile-profile-stage">
        <header className="mobile-profile-actions">
          <WorkspaceSwitch
            className="mobile-profile-admin-link"
            iconSize={18}
          />
          <ProfileEditLink aria-label="编辑资料">
            <SquarePen size={17} aria-hidden="true" />
            编辑
          </ProfileEditLink>
          <Link to="/settings">
            <Settings size={17} aria-hidden="true" />
            设置
          </Link>
        </header>
        <div
          className="mobile-profile-cover"
          data-cover-kind={illustration ? "illustration" : "photo"}
          aria-hidden="true"
        >
          {illustration ? (
            <img src={mediaUrl(fallback.pictureUrl?.[0])} alt="" />
          ) : (
            <FoodCover
              src={src}
              crop={cover.coverCrop}
              alt=""
              onError={photo.onError}
            />
          )}
        </div>
        <section className="mobile-profile-identity" aria-label="我的资料">
          <UserAvatar
            className="mobile-profile-avatar"
            avatar={user?.avatar}
            name={name}
          />
          <div className="mobile-profile-title-row">
            <h1 className="mobile-profile-name" title={name}>
              {name}
            </h1>
            <ProfileGrowth compact />
          </div>
          {user?.userName && user.hasUsername !== false && (
            <p className="mobile-profile-username">@{user.userName}</p>
          )}
          {user?.signature && (
            <p className="mobile-profile-signature">{user.signature}</p>
          )}
          <div className="mobile-profile-statistics">
            {stats.map(({ label, value, to }) => {
              const stat = (
                <>
                  <strong>
                    {value ??
                      (personal.isPending ? (
                        <span
                          className="ew-inline-skeleton"
                          aria-label="正在加载统计"
                        />
                      ) : (
                        "—"
                      ))}
                  </strong>
                  <span>{label}</span>
                </>
              );
              return to ? (
                <Link key={label} to={to}>
                  {stat}
                </Link>
              ) : (
                <div key={label}>{stat}</div>
              );
            })}
          </div>
        </section>
      </div>
      <ProfileSheet>
        <MarkerTabs
          items={profileTabs.map(({ id, name, icon: Icon }) => ({
            id,
            name,
            icon: <Icon aria-hidden="true" size={16} />,
          }))}
          value={tab}
          onChange={(next) => {
            if (next !== tab) select(next);
          }}
          panelId={panelId}
          label="我的内容分类"
          className="mobile-profile-tabs"
        />
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={panelId + tab}
          tabIndex={0}
          className="mobile-profile-panel"
        >
          {tab === "history" ? (
            <MobileHistoryContent />
          ) : (
            <ProfileFoods
              tab={tab}
              page={page}
              onPage={(next) => select(tab, next)}
            />
          )}
        </div>
      </ProfileSheet>
    </div>
  );
}
