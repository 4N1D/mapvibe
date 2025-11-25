import { RouterProvider } from "react-router-dom";
import router from "@/router";
import { SearchProvider } from "@/features/search/context/SearchContext";

export default function App() {
  return (
    <SearchProvider>
      <RouterProvider router={router} />
    </SearchProvider>
  );
}
