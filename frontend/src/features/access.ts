import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../app/state";
export function useActionAccess(){
 const {session,user,toast}=useApp(),nav=useNavigate(),loc=useLocation();
 return (verified=false)=>{if(!session){nav("/auth/password?next="+encodeURIComponent(loc.pathname+loc.search));return false;}if(user?.banned){toast("账号暂时无法操作，请联系管理员。");return false;}if(verified&&user?.verified!==true){nav("/verify");return false;}return true;};
}
