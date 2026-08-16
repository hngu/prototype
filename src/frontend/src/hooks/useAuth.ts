import { createContext, useContext } from "react";
import type { User } from "../api/types";

export interface SignupInput {
  fullName?: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

export interface AuthData {
  user: User | null;
  isInitializing: boolean;
  isSubmitting: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthData | null>(null);

export const useAuth = (): AuthData => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
