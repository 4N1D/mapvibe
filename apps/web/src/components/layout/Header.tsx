import { useState } from "react";
import { Button, cn } from "@mapvibe/ui-components";
import { Link } from "react-router-dom";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinkStyles = cn(
    "relative font-medium transition-colors",
    "text-gray-700 hover:text-primary-600",
    "after:absolute after:bottom-0 after:left-0",
    "after:h-0.5 after:w-0 after:bg-primary-600",
    "after:transition-all after:duration-300",
    "hover:after:w-full"
  );

  return (
    <header className="sticky top-0 z-50 border-b border-black bg-white shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center gap-2"
            >
              <span className="text-2xl font-bold text-gray-900">MapVibe</span>
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
              to="/explore"
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
            <Button
              variant="login"
              size="sm"
            >
              Đăng nhập
            </Button>
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
            <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
              <Button
                variant="login"
                size="sm"
                className="mx-auto px-8"
              >
                Đăng nhập
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
