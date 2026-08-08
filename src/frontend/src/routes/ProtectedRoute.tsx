import { useEffect } from "react";
import { useNavigate, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { LOGIN_ROUTE } from ".";

export const ProtectedRoute = () => {
  const navigate = useNavigate();
  const data = useAuth();

  useEffect(() => {
    if (!data?.user) {
      // user is not authenticated
      navigate(LOGIN_ROUTE);
      return;
    }
  });
  return <Outlet />;
};