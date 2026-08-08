import { createBrowserRouter } from "react-router";
import { RouterProvider as ReactRouterProvider } from "react-router/dom";
import { Home } from "./Home";
import { Login } from "./Auth/Login";
import { ProtectedRoute } from "./ProtectedRoute";
import { ShortURL } from "./ShortURL";
import { AuthProvider } from "../providers/AuthProvider";

export const LOGIN_ROUTE = '/app/login';

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
