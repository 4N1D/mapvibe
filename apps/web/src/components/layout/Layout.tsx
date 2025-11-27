import { Header } from "./Header";
import { Footer } from "./Footer";
import { Outlet, ScrollRestoration } from "react-router-dom";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <ScrollRestoration />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default Layout;
