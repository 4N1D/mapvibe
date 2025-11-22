import { Layout } from "@/components/layout";
import { HomePage } from "@/pages/HomePage";
import { createBrowserRouter, Navigate } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "/place/:id",
        element: <div> Search Detail Page (TODO)</div>,
      },
      {
        path: "/admin",
        element: <div>Admin Dashboard (TODO)</div>,
      },
      {
        path: "*",
        element: (
          <Navigate
            to="/"
            replace
          />
        ),
      },
    ],
  },
]);

export default router;
