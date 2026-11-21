import { Heart } from "lucide-react";

const members = [
  { name: "FooFish", role: "App 开发" },
  { name: "PyCmg", role: "Web 开发" },
  { name: "Jackie Ruan", role: "后端开发" },
  { name: "PATCHHHHH" },
];

export default function DevelopmentTeam() {
  return (
    <>
      <ul className="development-team-members" role="list">
        {members.map(({ name, role }) => (
          <li key={name}>
            <span>{name}</span>
            {role && <span className="development-team-role">{role}</span>}
          </li>
        ))}
      </ul>
      <footer className="development-team-credit" lang="en">
        Made with <Heart fill="currentColor" role="img" aria-label="love" /> and
        Token.
      </footer>
    </>
  );
}
