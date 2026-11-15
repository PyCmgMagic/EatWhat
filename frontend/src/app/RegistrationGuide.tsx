import { AtSign, ChevronRight, LockKeyhole, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "../components/ui";
import "./registration-guide.css";

const actions = [
  { label: "设置密码", to: "/settings/password", icon: LockKeyhole },
  { label: "设置登录名", to: "/settings/username", icon: AtSign },
  { label: "完善个人资料", to: "/me/edit", icon: UserRound },
] as const;

export default function RegistrationGuide({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <Modal title="注册成功" className="ew-registration-guide" onClose={onClose}>
      <ul className="ew-registration-actions">
        {actions.map(({ label, to, icon: Icon }) => (
          <li key={to}>
            <Link to={to} onClick={onClose}>
              <span className="ew-registration-action-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <span>{label}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" className="ew-registration-later" onClick={onClose}>
        稍后再说
      </button>
    </Modal>
  );
}
