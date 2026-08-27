import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Outlet } from "react-router";
import { TuyauHTTPError } from "@tuyau/core/client";
import {
  getProfile,
  isUser,
  login as loginRequest,
  logout as logoutRequest,
  signup as signupRequest,
  type User,
} from "../api/auth";
import { ACCESS_TOKEN_COOKIE } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { AuthContext, type SignupInput } from "../hooks/useAuth";
import { useCookie } from "../hooks/useCookie";
import { LOGIN_ROUTE } from "../routes";

const USER_COOKIE = "user";

export const AuthProvider = () => {
  const [storedUser, setUser, removeUser] = useCookie<User | null>({
    key: USER_COOKIE,
    defaultValue: null,
    getInitialValueInEffect: false,
  });
  const [token, setToken, removeToken] = useCookie<string | null>({
    key: ACCESS_TOKEN_COOKIE,
    defaultValue: null,
    getInitialValueInEffect: false,
  });

  const user = isUser(storedUser) && token ? storedUser : null;
  const [isInitializing, setIsInitializing] = useState(() => Boolean(token));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const clearSession = useCallback(() => {
    removeToken();
    removeUser();
  }, [removeToken, removeUser]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!token) {
        removeUser();
        setIsInitializing(false);
        return;
      }

      try {
        const profile = await getProfile();
        if (!cancelled) {
          setUser(profile);
        }
      } catch (error) {
        if (!cancelled && error instanceof TuyauHTTPError && error.isStatus(401)) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [token, setUser, removeUser, clearSession]);

  const persistSession = useCallback(
    (nextUser: User, nextToken: string) => {
      setToken(nextToken);
      setUser(nextUser);
    },
    [setToken, setUser],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      setIsSubmitting(true);
      try {
        const result = await loginRequest({ email, password });
        persistSession(result.user, result.token);
        navigate("/");
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigate, persistSession],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      setIsSubmitting(true);
      try {
        const result = await signupRequest({
          fullName: input.fullName?.trim() ? input.fullName.trim() : null,
          email: input.email,
          password: input.password,
          passwordConfirmation: input.passwordConfirmation,
        });
        persistSession(result.user, result.token);
        navigate("/");
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigate, persistSession],
  );

  const logout = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await logoutRequest();
    } catch {
      // Always clear the local session even if the API call fails.
    } finally {
      clearSession();
      setIsSubmitting(false);
      navigate(LOGIN_ROUTE, { replace: true });
    }
  }, [clearSession, navigate]);

  const value = useMemo(
    () => ({
      user,
      isInitializing,
      isSubmitting,
      login,
      signup,
      logout,
    }),
    [user, isInitializing, isSubmitting, login, signup, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      <AppHeader />
      <Outlet />
    </AuthContext.Provider>
  );
};
