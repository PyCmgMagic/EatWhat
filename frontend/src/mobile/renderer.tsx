import React, {
  Component,
  createElement,
  useEffect,
  useContext,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import { screenModules } from "virtual:eatwhat-screens";
import manifest from "./generated/manifest.json";
import {
  MobilePageSkeleton,
  ContentSkeleton,
} from "../components/LoadingSkeleton";
import type { DesignNode, Values, NodeView, Bridge } from "./types";
import { useDesignBridge } from "./bridge";
import { DesignNav, DesignIcon, DesignRegistryContext, useMobile } from "./ui";
import { readDraft, writeDraft } from "../app/drafts";

export class DesignController extends Component<any, any> {
  state: Values = {};
  static getDerivedStateFromProps(props: Values, state: Values) {
    const profile = !props.reference && props.screen === "G-EditProfile";
    if (
      state?.__initialized &&
      (!profile || state.__draftOwner === props.user?.id)
    )
      return null;
    if (!props.reference && props.screen === "G-EditProfile" && !props.user)
      return null;
    const patch: Values = { __initialized: true };
    if (!props.reference) {
      if (props.screen === "G-UserProfile") patch.menu = false;
      if (props.screen === "G-PasswordLogin")
        Object.assign(patch, { account: props.loginUserName ?? "", pwd: "" });
      if (
        [
          "G-PhoneLogin",
          "G-ChangePhone",
          "G-ForgotPassword",
          "G-DeleteAccount",
          "G-ChangePassword",
        ].includes(props.screen)
      )
        Object.assign(patch, {
          phone: "",
          code: "",
          pwd: "",
          user: "",
          old: "",
        });
      if (props.screen === "G-EditProfile")
        Object.assign(
          patch,
          readDraft(`profile-mobile:${props.user?.id}`, {
            nick: props.user?.displayName ?? "",
            sign: props.user?.signature ?? "",
          }),
          { __draftOwner: props.user?.id },
        );
      if (props.screen === "G-AddDish" && props.draft)
        Object.assign(patch, {
          desc: props.draft.description ?? "",
          cat: [
            "staple",
            "snack",
            "drink",
            "dessert",
            "soup",
            "hot_pot",
            "grill",
            "cold_dish",
            "side_dish",
            "other",
          ].indexOf(props.draft.category ?? "staple"),
        });
      if (props.screen === "G-Search")
        Object.assign(patch, { q: "", tab: "shop" });
      if (props.screen === "G-Follows")
        Object.assign(patch, {
          tab: props.tab === "follow" ? "follow" : "fans",
        });
      if (props.screen === "G-Verify")
        Object.assign(patch, {
          email: props.user?.verifiedEmail ?? "",
          code: "",
          sent: false,
        });
    }
    return patch;
  }
  componentWillUnmount() {
    const self = this as any;
    if (self.timer) clearInterval(self.timer);
  }
  componentDidUpdate(_previousProps: any, previousState: Values) {
    if (
      !this.props.reference &&
      this.props.screen === "G-EditProfile" &&
      this.props.user?.id &&
      (previousState.nick !== this.state.nick ||
        previousState.sign !== this.state.sign)
    ) {
      writeDraft(`profile-mobile:${this.props.user.id}`, {
        nick: String(this.state.nick ?? ""),
        sign: String(this.state.sign ?? ""),
      });
    }
  }
  renderVals(): Values {
    return {};
  }
  render() {
    return (
      <DesignRenderer
        screen={this.props.screen}
        controller={this}
        reference={this.props.reference}
      />
    );
  }
}
export function readBinding(expr: string, scope: Values): any {
  const path = expr.trim();
  if (path === "true") return true;
  if (path === "false") return false;
  if (!/^[a-zA-Z_$][\w$]*(?:\.[\w$]+)*$/.test(path)) return "";
  return path.split(".").reduce((value, key) => value?.[key], scope);
}
export function interpolate(raw: string | boolean, scope: Values): any {
  if (typeof raw !== "string") return raw;
  const full = raw.match(/^{{(.*?)}}$/s);
  if (full) return readBinding(full[1], scope);
  return raw.replace(/{{(.*?)}}/gs, (_, expr) =>
    String(readBinding(expr, scope) ?? ""),
  );
}
export function designStyle(raw: string): React.CSSProperties {
  const result: Values = {};
  for (const declaration of raw.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    let key = declaration.slice(0, colon).trim(),
      val = declaration.slice(colon + 1).trim();
    if (!key || !val) continue;
    if (key === "-webkit-backdrop-filter") key = "WebkitBackdropFilter";
    else if (!key.startsWith("--"))
      key = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    result[key] = val
      .replace(/\s*!important$/, "")
      .replace(/'Noto Sans SC'/g, "'Noto Sans SC Variable'")
      .replace(/'Bricolage Grotesque'/g, "'Bricolage Grotesque Variable'");
  }
  return result;
}
const propNames: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  maxlength: "maxLength",
  minlength: "minLength",
  autocomplete: "autoComplete",
  autocapitalize: "autoCapitalize",
  spellcheck: "spellCheck",
  inputmode: "inputMode",
  viewbox: "viewBox",
  preserveaspectratio: "preserveAspectRatio",
  strokewidth: "strokeWidth",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "stroke-dasharray": "strokeDasharray",
  "fill-opacity": "fillOpacity",
  "font-size": "fontSize",
  "font-family": "fontFamily",
  onpointerdown: "onPointerDown",
  onpointermove: "onPointerMove",
  onpointerup: "onPointerUp",
  onpointercancel: "onPointerCancel",
  onclick: "onClick",
  onchange: "onChange",
  oninput: "onInput",
};
function assets(value: string) {
  return value.replace(/^(?:\.\.\/)?assets\//, "/prototype/assets/");
}
export function textContent(node: DesignNode | string): string {
  return typeof node === "string"
    ? node
    : node.children.map(textContent).join("");
}
function Tree({
  screen,
  node,
  scope,
  bridge,
  path = "0",
}: {
  screen: string;
  node: DesignNode | string;
  scope: Values;
  bridge: Bridge;
  path?: string;
}): ReactNode {
  const registry = useContext(DesignRegistryContext);
  if (typeof node === "string") return interpolate(node, scope);
  if (node.tag === "sc-if")
    return interpolate(node.attrs.value, scope)
      ? node.children.map((c, i) => (
          <Tree
            key={i}
            screen={screen}
            node={c}
            scope={scope}
            bridge={bridge}
            path={`${path}.${i}`}
          />
        ))
      : null;
  if (node.tag === "sc-for") {
    const list = interpolate(node.attrs.list, scope);
    return Array.isArray(list)
      ? list.map((entry, i) => (
          <React.Fragment key={entry.id ?? entry.name ?? i}>
            {node.children.map((c, j) => (
              <Tree
                key={j}
                screen={screen}
                node={c}
                scope={{ ...scope, [String(node.attrs.as)]: entry }}
                bridge={bridge}
                path={`${path}.${i}.${j}`}
              />
            ))}
          </React.Fragment>
        ))
      : null;
  }
  if (node.tag === "dc-import") {
    const name = String(node.attrs.name);
    if (name === "G-Icon")
      return (
        <DesignIcon
          name={String(interpolate(node.attrs.icon, scope))}
          size={Number(interpolate(node.attrs.size, scope)) || 24}
        />
      );
    if (name === "G-Nav")
      return bridge.reference ? (
        <DesignNav active={String(node.attrs.active ?? "home")} />
      ) : null;
    const Imported = registry[name];
    return bridge.reference && Imported ? (
      <Imported screen={name} reference />
    ) : null;
  }
  const props: Values = { "data-design-node": node.id };
  for (const [raw, value] of Object.entries(node.attrs)) {
    if (raw.startsWith("hint-")) continue;
    const key = propNames[raw] ?? raw,
      val = interpolate(value, scope);
    if (key === "style") props.style = designStyle(String(val));
    else if (key === "src") props.src = assets(String(val ?? ""));
    else props[key] = val;
  }
  const tag = node.tag;
  if (
    (tag === "input" || tag === "textarea") &&
    props.value !== undefined &&
    !props.onChange
  ) {
    props.defaultValue = props.value;
    delete props.value;
  }
  if (tag === "input" && props.checked !== undefined && !props.onChange) {
    props.defaultChecked = props.checked;
    delete props.checked;
  }
  if (props.type === "checkbox" && typeof props.checked === "string")
    props.checked = props.checked === "true";
  if (typeof props.onClick === "function" && bridge.busy) props.disabled = true;
  const children = node.children.map((child, i) => (
    <Tree
      key={i}
      screen={screen}
      node={child}
      scope={scope}
      bridge={bridge}
      path={`${path}.${i}`}
    />
  ));
  if (path === "0") {
    const preview = (manifest as any)[screen]?.preview ?? {
      width: 390,
      height: 844,
    };
    props.className = `design-screen ${props.className ?? ""}`;
    props["data-screen"] = screen;
    props.style = {
      ...props.style,
      width: bridge.reference ? preview.width + "px" : "390px",
      height: bridge.reference
        ? preview.height + "px"
        : "var(--screen-height, 844px)",
      minHeight: bridge.reference
        ? preview.height + "px"
        : ["G2-Home", "G-HomePhoto", "G-Nearby", "G-Me"].includes(screen)
          ? "640px"
          : screen.startsWith("G-Panel")
            ? "0px"
            : "844px",
    };
  }
  const custom = bridge.node({
    node,
    props,
    children,
    text: textContent(node),
    scope,
    screen,
  });
  if (custom !== undefined) return custom;
  return createElement(tag, props, ...children);
}
type ScreenProps = { screen: string; bridge: Bridge };
const screenViews = Object.fromEntries(
  Object.entries(screenModules).map(([name, load]) => [
    name,
    lazy(() =>
      load().then(({ default: design }) => ({
        default: (props: ScreenProps) => (
          <ResolvedScreen {...props} design={design} />
        ),
      })),
    ),
  ]),
);
function ScreenFallback({ screen }: { screen: string }) {
  const mobile = useMobile();
  if (screen.startsWith("G-Panel"))
    return (
      <div
        className="mobile-status"
        role="dialog"
        aria-modal="true"
        aria-label="正在加载面板"
      >
        <ContentSkeleton kind="rows" count={2} />
        <button className="mobile-inline-link" onClick={mobile.closePanel}>
          关闭
        </button>
      </div>
    );
  return <MobilePageSkeleton screen={screen} />;
}
function DesignRenderer({
  screen,
  controller,
  reference,
}: {
  screen: string;
  controller: DesignController;
  reference?: boolean;
}) {
  const original = controller.renderVals();
  const bridge = useDesignBridge(screen, controller, original, !!reference);
  const Screen = screenViews[screen];
  return Screen ? (
    <Suspense
      fallback={
        <div className="mobile-code-loading">
          <ScreenFallback screen={screen} />
        </div>
      }
    >
      <Screen screen={screen} bridge={bridge} />
    </Suspense>
  ) : null;
}
function ResolvedScreen({
  screen,
  bridge,
  design,
}: ScreenProps & {
  design: Awaited<ReturnType<(typeof screenModules)[string]>>["default"];
}) {
  useEffect(() => {
    document.title = design?.title ?? "山软今天吃什么";
  }, [design]);
  if (!design) return null;
  return (
    <>
      <style>{design.css}</style>
      {bridge.before}
      {bridge.hideContent ? (
        <div className="design-screen mobile-data-loading" />
      ) : (
        <Tree
          screen={screen}
          node={design.tree}
          scope={bridge.values}
          bridge={bridge}
        />
      )}
      {bridge.after}
    </>
  );
}
