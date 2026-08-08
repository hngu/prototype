import { createContext, useContext } from "react";

interface AuthData {
  user: string;
  login: (data: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthData | null>(null);

export const useAuth = () => {
  return useContext(AuthContext);
};
