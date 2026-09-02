import { createBrowserRouter } from "react-router";
import { RouterProvider as ReactRouterProvider } from "react-router/dom";
import { Home } from "./Home";
import { Login } from "./Auth/Login";
import { GuestRoute } from "./GuestRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { ShortURL } from "./ShortURL";
import { AuthProvider } from "../providers/AuthProvider";
import { Signup } from "./Auth/Signup";
import { BookTicket } from "./BookTicket";
import { Sandbox } from "./Sandbox";

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
        Component: GuestRoute,
        children: [
          {
            path: LOGIN_ROUTE,
            Component: Login,
          },
          {
            path: SIGNUP_ROUTE,
            Component: Signup,
          },
        ],
      },
      {
        path: '/app/sandbox',
        Component: Sandbox,
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
      },
      {
        path: "app/bookticket",
        Component: ProtectedRoute,
        children: [
          {
            index: true,
            Component: BookTicket,
          }
        ]
      }
    ]
  }

]);

export const RouterProvider = () => {
  return <ReactRouterProvider router={router} />;
};
