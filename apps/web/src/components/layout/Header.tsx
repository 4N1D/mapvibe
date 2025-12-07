import { useState, useRef, useEffect } from "react";
import { Button, cn } from "@mapvibe/ui-components";
import { Link } from "react-router-dom";
import { LoginModal } from "../auth/LoginModal";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Settings, ChevronDown, User } from "lucide-react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, isAuthenticated, signOut } = useAuth();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navLinkStyles = cn(
    "relative font-medium transition-colors",
    "text-gray-700 hover:text-primary-600",
    "after:absolute after:bottom-0 after:left-0",
    "after:h-0.5 after:w-0 after:bg-primary-600",
    "after:transition-all after:duration-300",
    "hover:after:w-full"
  );

  const handleLogout = () => {
    signOut();
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  };

  // Click outside to close user menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-black bg-white shadow-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Link
                to="/"
                className="flex items-center gap-2"
              >
                <img
                  src="/images/logo.png"
                  alt="mapvibe-logo"
                  className="h-8 w-auto object-contain transition-opacity hover:opacity-80"
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-10 md:flex">
              <Link
                to="/"
                className={navLinkStyles}
              >
                Trang chủ
              </Link>
              <Link
                to="/suggest"
                className={navLinkStyles}
              >
                Đề xuất địa điểm
              </Link>
              <Link
                to="/nearby"
                className={navLinkStyles}
              >
                Khám phá và đánh giá
              </Link>
            </nav>

            {/* Desktop Auth Buttons */}
            <div className="hidden items-center gap-3 md:flex">
              {isAuthenticated ? (
                <div
                  className="relative"
                  ref={userMenuRef}
                >
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 transition-colors hover:bg-gray-200"
                  >
                    {/* Avatar Circle */}
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white">
                      <span className="text-sm font-semibold">
                        {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    {/* Name */}
                    <span className="text-sm font-medium text-gray-700">
                      {user?.name || user?.email?.split("@")[0]}
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", userMenuOpen && "rotate-180")}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="animate-in fade-in zoom-in-95 absolute right-0 top-full mt-2 w-56 origin-top-right rounded-xl border border-gray-100 bg-white p-2 shadow-lg ring-1 ring-black ring-opacity-5 duration-200 focus:outline-none">
                      <div className="mb-2 border-b border-gray-100 px-3 py-2">
                        <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                        <p className="truncate text-xs text-gray-500">{user?.email}</p>
                      </div>

                      <Link
                        to="/profile"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User className="h-4 w-4" />
                        Hồ sơ của tôi
                      </Link>

                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="login"
                  size="sm"
                  onClick={() => setLoginModalOpen(true)}
                >
                  Đăng nhập
                </Button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="border-t border-gray-100 py-4 md:hidden">
              <nav className="flex flex-col gap-2">
                <Link
                  to="/"
                  className="rounded-lg px-3 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Trang chủ
                </Link>
                <Link
                  to="/explore"
                  className="rounded-lg px-3 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Đề xuất địa điểm
                </Link>
                <Link
                  to="/nearby"
                  className="rounded-lg px-3 py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Khám phá và đánh giá
                </Link>
              </nav>

              {/* Mobile Auth */}
              <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
                {isAuthenticated ? (
                  <>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white">
                        <span className="text-sm font-semibold">
                          {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                        <div className="text-xs text-gray-500">{user?.email}</div>
                      </div>
                    </div>

                    <Link
                      to="/profile"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Hồ sơ của tôi
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      Cài đặt tài khoản
                    </Link>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="justify-start gap-2 px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <LogOut className="h-4 w-4" />
                      Đăng xuất
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="login"
                    size="sm"
                    onClick={() => {
                      setLoginModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="mx-auto px-8"
                  >
                    Đăng nhập
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />
    </>
  );
}
