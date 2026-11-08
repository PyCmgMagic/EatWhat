import { useQuery } from "@tanstack/react-query";
import { Check, RotateCw } from "lucide-react";
import { useApp } from "../app/state";
import { errorMessage } from "../api/client";
import "./account-extras.css";

export function VerificationMethods() {
  const { api, session } = useApp();
  const query = useQuery({
    queryKey: ["verification-methods"],
    queryFn: () => api.verified(),
    enabled: !!session,
  });
  return (
    <section className="ew-verification-methods" aria-label="认证记录">
      <header className="ew-verification-methods-heading">
        <h3>认证记录</h3>
        {!query.isPending && (
          <button
            type="button"
            aria-label={query.isError ? "重新读取认证记录" : "刷新认证记录"}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RotateCw size={14} aria-hidden="true" />
            {query.isFetching ? "刷新中…" : query.isError ? "重试" : "刷新记录"}
          </button>
        )}
      </header>
      {query.isPending ? (
        <span role="status">正在读取认证记录…</span>
      ) : query.isError ? (
        <span role="alert">{errorMessage(query.error)}</span>
      ) : (
        <div className="ew-verification-methods-list">
          {query.data.length ? (
            query.data.map((method) => (
              <span key={method} className="ew-method-badge">
                <Check size={16} aria-hidden="true" />
                {method === "verify:sso"
                  ? "山东大学统一认证"
                  : method === "verify:school_email"
                    ? "学校邮箱认证"
                    : "其他认证方式"}
              </span>
            ))
          ) : (
            <span>暂未记录已完成的认证方式</span>
          )}
        </div>
      )}
    </section>
  );
}
