import { Navigate, useLocation } from "react-router-dom";

// Keep saved directory links, including their search and filter parameters.
export default function Directory() {
  const { search, state } = useLocation();
  return <Navigate replace to={{ pathname: "/nearby", search }} state={state} />;
}
