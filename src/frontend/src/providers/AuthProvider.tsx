import { useMemo } from "react";
import { useNavigate, Outlet } from "react-router";
import { AuthContext } from "../hooks/useAuth";
import { useCookie } from "../hooks/useCookie";
import { LOGIN_ROUTE } from "../routes";

export const AuthProvider = () => {
  const [user, setUser] = useCookie<string | null>({
    key: "user",
    defaultValue: null,
  });

  const navigate = useNavigate();


  const value = useMemo(() => {
    // call this function when you want to authenticate the user
    const login = async (data: string) => {
      setUser(data);
      navigate("/");
    };


    // call this function to sign out logged in user
    const logout = () => {
      setUser(null);
      navigate(LOGIN_ROUTE, { replace: true });
    };


    return { user, login, logout };
  }, [user, navigate, setUser]);


  return (
    <AuthContext.Provider value={value}>
      <Outlet />
    </AuthContext.Provider>
  );
};