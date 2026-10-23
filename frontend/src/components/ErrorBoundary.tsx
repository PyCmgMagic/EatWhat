import { Component, type ReactNode, type ErrorInfo } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Render a recovery action without logging sensitive request data. */
  }
  render() {
    return this.state.failed ? (
      <div className="fatal-error">
        <h1>页面遇到一点问题</h1>
        <p>刷新后再试，未提交的表单内容可能需要重新填写。</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          重新加载
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
