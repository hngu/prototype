import { Navigate, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { LOGIN_ROUTE } from ".";

export const ProtectedRoute = () => {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return null;
  }

  if (!user) {
    return <Navigate to={LOGIN_ROUTE} replace />;
  }

  return <Outlet />;
};
