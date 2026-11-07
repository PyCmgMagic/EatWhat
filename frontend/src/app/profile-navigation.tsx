import { Link, useLocation, type LinkProps } from "react-router-dom";
import { localDestination, useReturnTo } from "./navigation";

function profileDestination(value: unknown) {
  const destination = localDestination(value);
  return destination && !/^\/me\/(edit|details)(?:[/?#]|$)/.test(destination)
    ? destination
    : undefined;
}

/** The whole editor flow keeps its entry page, including refresh and details. */
export function useProfileReturnTo() {
  const location = useLocation();
  const previous = useReturnTo("/me");
  return (
    profileDestination(location.state?.returnTo) ??
    profileDestination(previous) ??
    "/me"
  );
}

export function ProfileEditLink({ state, ...props }: Omit<LinkProps, "to">) {
  const location = useLocation();
  const fallback = useProfileReturnTo();
  const returnTo =
    profileDestination(location.pathname + location.search) ?? fallback;
  return <Link {...props} to="/me/edit" state={{ ...state, returnTo }} />;
}
