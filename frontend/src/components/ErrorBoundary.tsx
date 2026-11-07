import { Component, createRef, type ReactNode, type ErrorInfo } from "react";
import "@fontsource-variable/noto-sans-sc";
import "../mobile/generated/tokens.css";
import "./error-boundary.css";
import { DishIllustration } from "./DishIllustration";

// Recovery must work even when the router, providers or their modules fail.
// Keep the fallback and its inline icons independent of the application UI.
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  private heading = createRef<HTMLHeadingElement>();
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Render a recovery action without logging sensitive request data. */
    document.title = "页面暂时无法显示 · 山软今天吃什么";
    this.heading.current?.focus();
  }
  render() {
    return this.state.failed ? (
      <div className="fatal-error">
        <header className="fatal-error-brand">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="26" height="26">
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              d="M9 17.5v1a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-1m-4-.5h2a8 8 0 0 0 8-8V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v2a8 8 0 0 0 8 8Z"
            />
          </svg>
          <span>山软今天吃什么</span>
        </header>
        <main className="fatal-error-main">
          <div className="fatal-error-content">
            <div className="fatal-error-illustration" aria-hidden="true">
              <DishIllustration name="yuntun" />
              <span className="fatal-error-art-badge">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path
                    d="M12 6v7m0 5v.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </div>
            <h1 id="fatal-error-title" ref={this.heading} tabIndex={-1}>
              页面遇到
              <br />
              一点问题
            </h1>
            <p className="fatal-error-description">
              可以重新加载这一页，
              <br />
              或回到首页继续找好吃的。
            </p>
            <div className="fatal-error-actions">
              <a
                className="fatal-error-action secondary"
                tabIndex={0}
                href={`${location.pathname}${location.search}#/`}
                onClick={(event) => {
                  event.preventDefault();
                  // A hash change alone cannot reset an already failed boundary.
                  history.replaceState(
                    null,
                    "",
                    `${location.pathname}${location.search}#/`,
                  );
                  location.reload();
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                >
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 12h.002M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0M7.757 16.243c-.353-.354.708-4.95 2.122-6.364s6.01-2.475 6.364-2.121c.353.353-.707 4.95-2.122 6.363c-1.414 1.415-6.01 2.475-6.364 2.122"
                  />
                </svg>
                回到首页
              </a>
              <button
                className="fatal-error-action primary"
                tabIndex={0}
                onClick={() => location.reload()}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                >
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.811 8.264A9 9 0 0 1 14.33 3.307a9 9 0 0 1 6.672 8.622c0 .08-.088.126-.154.082l-2.678-1.804c-.091-.062-.03-.205.078-.181L20 10.41m.189 5.327c-1.789 3.932-6.208 6.112-10.519 4.956a9 9 0 0 1-6.672-8.622c0-.08.088-.126.154-.082l2.678 1.805c.091.061.03.204-.078.18L4 13.59"
                  />
                </svg>
                重新加载
              </button>
            </div>
            <p className="fatal-error-note">未提交的内容可能需要重新填写。</p>
          </div>
        </main>
        <footer className="fatal-error-footer">好好吃饭，认真生活</footer>
      </div>
    ) : (
      this.props.children
    );
  }
}
