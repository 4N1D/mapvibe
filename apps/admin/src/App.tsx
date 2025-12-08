import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PlacesPage from './pages/PlacesPage';
import ReviewsPage from './pages/ReviewsPage';
import UsersPage from './pages/UsersPage';
import PendingLocationsPage from './pages/PendingLocationsPage';
import LocationDetailPage from './pages/LocationDetailPage';
import ProfilePage from './pages/ProfilePage';
import ReportsPage from './pages/ReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuthCallback from './pages/AuthCallback';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/locations/pending" element={<PendingLocationsPage />} />
                <Route path="/locations/:id" element={<LocationDetailPage />} />
                <Route path="/places" element={<PlacesPage />} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
