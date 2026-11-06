import type { RecoveryCommand } from "../../api/recovery";
export default function RecoveryFile({
  value,
  kind,
}: {
  value: RecoveryCommand;
  kind: string;
}) {
  return (
    <details>
      <summary>保存本次恢复信息</summary>
      <p>
        刷新会清空本页凭据。可自行保存恢复文件，以便重新打开页面后查询或恢复操作；文件包含本次操作的恢复凭据，请妥善保管。
      </p>
      <button
        type="button"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify({ kind, ...value })], {
              type: "application/json",
            }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = "EatWhat-恢复信息.json";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        保存恢复文件
      </button>
    </details>
  );
}
