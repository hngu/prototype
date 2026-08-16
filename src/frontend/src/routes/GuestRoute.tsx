import { Navigate, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";

export const GuestRoute = () => {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return null;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
