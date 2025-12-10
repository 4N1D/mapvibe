import { Layout } from "@/components/layout";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { HomePage } from "@/pages/HomePage";
import { PlaceDetailPage } from "@/pages/PlaceDetailPage";
import { PostDetailPage } from "@/pages/PostDetailPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { NearbyPage } from "@/pages/NearbyPage";
import { SuggestPlacePage } from "@/pages/SuggestPlacePage";
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
        path: "/place/:slug",
        element: <PlaceDetailPage />,
      },
      {
        path: "/post/:slug",
        element: <PostDetailPage />,
      },
      {
        path: "/suggest",
        element: <SuggestPlacePage />,
      },
      {
        path: "/auth/callback",
        element: <AuthCallbackPage />,
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },
      {
        path: "/nearby",
        element: <NearbyPage />,
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
