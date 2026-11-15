/** Old registration bookmarks share the current SMS login/registration flow. */
export function normalizeAuthRoute(to: string) {
  return to.replace(
    /^\/auth\/username-register\/?(?=[?#]|$)/,
    "/auth/register",
  );
}

export function isPhoneAuthPath(path: string) {
  return ["/auth/register", "/auth/register/confirm"].includes(
    normalizeAuthRoute(path.replace(/\/+$/, "")),
  );
}

export function isStandaloneLoginPath(path: string) {
  return (
    path === "/auth" ||
    path === "/auth/password" ||
    path === "/auth/forgot" ||
    isPhoneAuthPath(path)
  );
}
