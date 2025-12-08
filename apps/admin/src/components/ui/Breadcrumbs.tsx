import { Link, useLocation } from 'react-router-dom';
import { Fragment } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

const routeLabels: Record<string, string> = {
  '': 'Tổng quan',
  'locations': 'Địa điểm',
  'pending': 'Chờ duyệt',
  'places': 'Nhà hàng',
  'reviews': 'Đánh giá',
  'users': 'Người dùng',
  'reports': 'Báo cáo',
  'analytics': 'Phân tích',
  'profile': 'Hồ sơ',
};

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const location = useLocation();
  
  const breadcrumbs: BreadcrumbItem[] = items || generateBreadcrumbs(location.pathname);

  if (breadcrumbs.length <= 1) return null;

  return (
    <nav className="flex mb-4" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {breadcrumbs.map((item, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
            <li>
              {item.href && index < breadcrumbs.length - 1 ? (
                <Link
                  to={item.href}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-sm font-medium text-gray-900">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const paths = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [{ label: 'Tổng quan', href: '/' }];

  let currentPath = '';
  for (const path of paths) {
    currentPath += `/${path}`;
    const label = routeLabels[path] || (path.length === 36 ? 'Chi tiết' : path);
    breadcrumbs.push({ label, href: currentPath });
  }

  return breadcrumbs;
}
