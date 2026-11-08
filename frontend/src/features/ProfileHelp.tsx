import { useState } from "react";
import { Link } from "react-router-dom";
import { DesignIcon as Icon } from "../mobile/ui";
import ProfileSectionNav from "./ProfileSectionNav";
import { DishIllustration } from "../components/DishIllustration";
import "./profile-help.css";

const questions = [
  {
    id: "audit",
    category: "分享与收藏",
    title: "在哪里查看分享的审核进度？",
    answer:
      "进入“我的分享”，选择“审核进度”，可以查看菜品和店铺提交的处理状态。点开一条记录，可以查看这次提交的详情。",
    to: "/submissions",
    action: "查看审核进度",
  },
  {
    id: "collections",
    category: "分享与收藏",
    title: "如何整理收藏的菜品和餐厅？",
    answer:
      "在“我的收藏”中切换菜品与餐厅。菜品可以按分类、预算或自己的标签筛选；标签可以在同一页面的“标签管理”中整理。",
    to: "/favorites",
    action: "打开我的收藏",
  },
  {
    id: "history",
    category: "分享与收藏",
    title: "想找回之前看过的菜品，去哪里？",
    answer:
      "“浏览足迹”保留了浏览记录，可以从这里重新打开看过的内容。遇到喜欢的菜品，也可以收藏起来，方便下次查找。",
    to: "/history",
    action: "查看浏览足迹",
  },
  {
    id: "account",
    category: "账号与消息",
    title: "个人资料和账号设置分别在哪里修改？",
    answer:
      "点击“编辑资料”修改昵称、头像和个人介绍。手机号、登录密码、学生认证以及隐私选项，统一在“账号设置”中管理。",
    to: "/settings",
    action: "打开账号设置",
  },
  {
    id: "notifications",
    category: "账号与消息",
    title: "如何调整收到的消息提醒？",
    answer:
      "在“通知偏好”里查看和调整消息提醒。已经收到的互动消息可以在“消息通知”中查看，站点公告也有独立的分类。",
    to: "/settings/notifications",
    action: "调整通知偏好",
  },
  {
    id: "feedback",
    category: "反馈",
    title: "反馈提交后，在哪里查看回复？",
    answer:
      "打开“反馈记录”，找到对应的反馈，查看处理状态和回复。提交问题时尽量写清出现在哪个页面、进行了什么操作，也可以附上图片。",
    to: "/feedback/mine",
    action: "查看反馈记录",
  },
];
const categories = ["全部", "分享与收藏", "账号与消息", "反馈"];

export default function ProfileHelp() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = questions.filter(
    (question) =>
      (category === "全部" || category === question.category) &&
      terms.every((term) =>
        `${question.title} ${question.answer} ${question.category}`
          .toLocaleLowerCase()
          .includes(term),
      ),
  );
  return (
    <section className="profile-help">
      <header>
        <span className="profile-page-eyebrow">使用帮助</span>
        <h1>帮助与反馈</h1>
        <p>遇到问题，或有一个让这里更好的想法，都可以告诉我们。</p>
      </header>
      <ProfileSectionNav section="help" />
      <div className="profile-help-search">
        <Icon name="search" size={21} />
        <label
          className="profile-help-search-label"
          htmlFor="profile-help-search"
        >
          搜索使用帮助
        </label>
        <input
          id="profile-help-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索问题，例如：收藏、审核、手机号"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="清除问题搜索"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      <div className="profile-help-layout">
        <section
          className="profile-help-questions"
          aria-labelledby="profile-help-questions-title"
        >
          <div className="profile-help-question-heading">
            <h2 id="profile-help-questions-title">常见问题</h2>
            <span role="status">{filtered.length} 个问题</span>
          </div>
          <div className="profile-help-categories" aria-label="问题分类">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="profile-help-question-list">
            {filtered.map((question) => (
              <details key={question.id}>
                <summary>
                  <span>{question.title}</span>
                  <Icon name="add" size={18} />
                </summary>
                <div className="profile-help-answer">
                  <p>{question.answer}</p>
                  <Link to={question.to}>
                    {question.action}
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </div>
              </details>
            ))}
            {!filtered.length && (
              <div className="profile-help-empty">
                <Icon name="search" size={26} />
                <h3>没有找到相关问题</h3>
                <p>试试“收藏”或“账号”等关键词，也可以直接提交反馈。</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("全部");
                  }}
                >
                  查看全部问题
                </button>
              </div>
            )}
          </div>
        </section>
        <aside className="profile-help-actions" aria-label="反馈入口">
          <section className="profile-help-contact">
            <DishIllustration
              name="baozi"
              className="profile-help-contact-dish"
            />
            <h2>还有其他问题？</h2>
            <p>告诉我们发生了什么，也欢迎分享你对这里的建议。</p>
            <Link to="/feedback">
              提交反馈
              <Icon name="chevronRight" size={18} />
            </Link>
          </section>
          <Link className="profile-help-records" to="/feedback/mine">
            <Icon name="mail" size={22} />
            <span>
              <strong>反馈记录</strong>
              <small>查看处理状态和回复</small>
            </span>
            <Icon name="chevronRight" size={18} />
          </Link>
          <p className="profile-help-tip">
            <Icon name="info" size={16} />
            描述清楚页面和操作步骤，能帮助我们更快定位问题。
          </p>
        </aside>
      </div>
      <div className="profile-help-links">
        <Link to="/settings/about">关于我们</Link>
        <Link to="/data-notice">数据存放说明</Link>
        <Link to="/features">查找其他功能</Link>
      </div>
    </section>
  );
}
