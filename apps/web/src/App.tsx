import { RouterProvider } from "react-router-dom";
import router from "@/router";
import { SearchProvider } from "@/features/search/context/SearchContext";
import { AuthProvider } from "./contexts/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <SearchProvider>
        <RouterProvider router={router} />
      </SearchProvider>
    </AuthProvider>
  );
}
