import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.mapvibe.site';
const isLocalhost = API_URL.includes('localhost');

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(isLocalhost ? {} : { 'ngrok-skip-browser-warning': 'true' }),
  },
  timeout: 10000,
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('[API] Token added:', token.substring(0, 20) + '...');
    } else {
      console.warn('[API] No token available - user may not be logged in');
    }
  } catch (err) {
    console.error('[API] Failed to get session:', err);
  }
  return config;
});

// Admin API functions
export const adminApi = {
  // Stats
  getStats: () => apiClient.get('/admin/stats'),

  // Places
  getPlaces: (params?: { limit?: number; offset?: number; search?: string; status?: string }) =>
    apiClient.get('/admin/places', { params }),
  getPlace: (id: string) => apiClient.get(`/admin/places/${id}`),
  updatePlace: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/admin/places/${id}`, data),
  deletePlace: (id: string) => apiClient.delete(`/admin/places/${id}`),

  // Reviews
  getReviews: (params?: { limit?: number; offset?: number; status?: string }) =>
    apiClient.get('/admin/reviews', { params }),
  getReview: (id: string) => apiClient.get(`/admin/reviews/${id}`),
  updateReview: (id: string, action: string, reason?: string) =>
    apiClient.patch(`/admin/reviews/${id}`, { action, reason }),

  // Pending Locations
  getPendingLocations: (params?: { limit?: number; offset?: number }) =>
    apiClient.get('/admin/locations/pending', { params }),
  updateLocation: (id: string, action: 'approve' | 'reject', reason?: string) =>
    apiClient.patch(`/admin/locations/${id}`, { action, reason }),

  // Users
  getUsers: (params?: { limit?: number; offset?: number; search?: string; status?: string }) =>
    apiClient.get('/admin/users', { params }),
  getUser: (id: string) => apiClient.get(`/admin/users/${id}`),
  updateUser: (id: string, action: string, reason?: string, role?: string) =>
    apiClient.patch(`/admin/users/${id}`, { action, reason, role }),

  // Reports
  getReports: (params?: { limit?: number; offset?: number; status?: string; target_type?: string; reason?: string }) =>
    apiClient.get('/admin/reports', { params }),
  getReport: (id: string) => apiClient.get(`/admin/reports/${id}`),
  updateReport: (id: string, data: { status?: string; admin_notes?: string; action?: string }) =>
    apiClient.patch(`/admin/reports/${id}`, data),

  // Activities
  getActivities: (params?: { limit?: number; offset?: number; user_id?: string; activity_type?: string; date_from?: string; date_to?: string }) =>
    apiClient.get('/admin/activities', { params }),
  getActivityStats: (params?: { days?: number }) =>
    apiClient.get('/admin/activities/stats', { params }),
  getUserActivities: (userId: string, params?: { limit?: number; offset?: number }) =>
    apiClient.get(`/admin/activities/user/${userId}`, { params }),
};
