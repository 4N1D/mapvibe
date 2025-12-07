import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { fetchAuthSession } from "aws-amplify/auth";

const API_URL = import.meta.env.VITE_API_URL;

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // User not authenticated, continue without token
    }
    
    console.log(`[${config.method?.toUpperCase()}] ${config.url}`);
    
    // Add Authorization header with JWT token
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      
      if (idToken) {
        config.headers.Authorization = `Bearer ${idToken}`;
        console.log("[Auth] Added JWT token to request");
      }
    } catch (error) {
      console.warn("[Auth] Failed to get session token:", error);
      // Continue with request even if token is not available
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log(`[${response.status}] ${response.config.url}`);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;

    console.error(`[${error.response?.status}] ${originalRequest?.url}`);
    console.error("Error details:", error.response?.data || error.message);

    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Unauthorized - redirect to login (sau này)
          // window.location.href = "/login";
          console.warn("Unauthorized - cần đăng nhập");
          break;

        case 403:
          // Forbidden
          console.warn("Forbidden - không có quyền truy cập");
          break;

        case 404:
          // Not found
          console.warn("Not found - API endpoint không tồn tại");
          break;

        case 500:
          // Server error
          console.warn("Server error - lỗi phía server");
          break;

        default:
          break;
      }
    } else if (error.code === "ECONNABORTED") {
      // Timeout
      console.warn("Request timeout - quá thời gian chờ");
    } else if (!error.response) {
      // Network error
      console.warn("Network error - kiểm tra kết nối mạng");
    }

    return Promise.reject(error);
  }
);

// Dùng để hủy request
export const createCancelToken = () => {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
};

// Dùng để retry request
export const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry attempt ${i + 1}/${retries}...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries reached");
};

export default apiClient;
