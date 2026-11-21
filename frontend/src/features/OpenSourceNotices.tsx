import notices from "virtual:open-source-notices";

export default function OpenSourceNotices() {
  return (
    <div className="about-licenses">
      {notices.map(({ name, version, license, text }) => (
        <details key={name + "@" + version}>
          <summary>
            <span>
              {name} <small>{version}</small>
            </span>
            {license && <small>{license}</small>}
          </summary>
          {text ? (
            <pre>{text}</pre>
          ) : (
            <a href={`https://www.npmjs.com/package/${name}/v/${version}`}>
              查看软件包声明
            </a>
          )}
        </details>
      ))}
    </div>
  );
}
