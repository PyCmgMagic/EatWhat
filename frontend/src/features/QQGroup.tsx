import { ChevronDown, QrCode } from "lucide-react";
import "./qq-group.css";

const groups = {
  chat: {
    name: "QQ 聊天群",
    number: "810842583",
    poster: "/assets/qq-groups/chat.jpg",
  },
  feedback: {
    name: "QQ 反馈群",
    number: "1127823263",
    poster: "/assets/qq-groups/feedback.jpg",
  },
};

export function QQGroup({ group }: { group: keyof typeof groups }) {
  const { name, number, poster } = groups[group];
  return (
    <details className="qq-group">
      <summary>
        <QrCode size={22} aria-hidden="true" />
        {name}
        <ChevronDown
          className="qq-group-chevron"
          size={20}
          aria-hidden="true"
        />
      </summary>
      <div className="qq-group-content">
        <img
          src={poster}
          alt={`${name}加群二维码`}
          width={1284}
          height={2280}
          loading="lazy"
        />
        <span>群号 {number}</span>
        <a href={poster} download={`${name}二维码.jpg`}>
          保存二维码
        </a>
      </div>
    </details>
  );
}
