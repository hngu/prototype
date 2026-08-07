import { createBrowserRouter } from "react-router";
import { RouterProvider as ReactRouterProvider } from "react-router/dom";
import { Home } from "./Home/Home";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
]);

export const RouterProvider = () => {
  return <ReactRouterProvider router={router} />;
};
