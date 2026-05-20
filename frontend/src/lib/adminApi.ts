import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAdminKey = () => {
  const key = localStorage.getItem('adminKey');
  if (!key) throw new Error('Admin key not found');
  return key;
};

// Create axios instance with interceptor for 401
const adminAxios = axios.create();

adminAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Invalid admin key - clear storage and redirect
      localStorage.removeItem('adminKey');
      window.dispatchEvent(new Event('admin:logout'));
    }
    return Promise.reject(error);
  }
);

export const adminApi = {
  verify: async () => {
    const response = await adminAxios.get(`${API_URL}/admin/verify`, {
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },
  getStats: async () => {
    const response = await adminAxios.get(`${API_URL}/admin/stats`, {
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },
  getUsers: async (params: { search?: string; limit?: number; offset?: number }) => {
    const response = await adminAxios.get(`${API_URL}/admin/users`, {
      params,
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },
  getUserDetails: async (userId: string) => {
    const response = await adminAxios.get(`${API_URL}/admin/users/${userId}`, {
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },
  getFeedback: async (params: { resolved?: boolean; type?: string; limit?: number; offset?: number }) => {
    const response = await adminAxios.get(`${API_URL}/admin/feedback`, {
      params,
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },
  resolveFeedback: async (id: string) => {
    const response = await adminAxios.put(`${API_URL}/admin/feedback/${id}/resolve`, {}, {
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },
  refreshLeaderboard: async () => {
    const response = await adminAxios.post(`${API_URL}/admin/refresh-leaderboard`, {}, {
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },
};