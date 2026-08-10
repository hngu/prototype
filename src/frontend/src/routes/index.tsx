import { createBrowserRouter } from "react-router";
import { RouterProvider as ReactRouterProvider } from "react-router/dom";
import { Home } from "./Home";
import { Login } from "./Auth/Login";
import { ProtectedRoute } from "./ProtectedRoute";
import { ShortURL } from "./ShortURL";
import { AuthProvider } from "../providers/AuthProvider";
import { Signup } from "./Auth/Signup";

export const LOGIN_ROUTE = '/app/login';
export const SIGNUP_ROUTE = '/app/signup';

const router = createBrowserRouter([
  {
    Component: AuthProvider,
    children: [
      {
        path: "/",
        Component: Home,
      },
      {
        path: LOGIN_ROUTE,
        Component: Login,
      },
      {
        path: SIGNUP_ROUTE,
        Component: Signup,
      },
      {
        path: "/app/shorturl",
        Component: ProtectedRoute,
        children: [
          {
            index: true,
            Component: ShortURL,
          },
        ],
      }
    ]
  }

]);

export const RouterProvider = () => {
  return <ReactRouterProvider router={router} />;
};
