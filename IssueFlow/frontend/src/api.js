import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("issueflow_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("issueflow_token");
      localStorage.removeItem("issueflow_user");
      if (window.location.pathname !== "/login") {
        window.dispatchEvent(new Event("issueflow:unauthorized"));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
