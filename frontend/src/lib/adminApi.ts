import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAdminKey = () => {
  const key = localStorage.getItem('adminKey');
  if (!key) throw new Error('Admin key not found');
  return key;
};

export const adminApi = {
  // Dashboard
  getStats: async () => {
    const response = await axios.get(`${API_URL}/admin/stats`, {
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },

  // User management
  getUsers: async (params: { search?: string; limit?: number; offset?: number }) => {
    const response = await axios.get(`${API_URL}/admin/users`, {
      params,
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },

  getUserDetails: async (userId: string) => {
    const response = await axios.get(`${API_URL}/admin/users/${userId}`, {
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },

  // Feedback management
  getFeedback: async (params: { resolved?: boolean; type?: string; limit?: number; offset?: number }) => {
    const response = await axios.get(`${API_URL}/admin/feedback`, {
      params,
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },

  resolveFeedback: async (id: string) => {
    const response = await axios.put(`${API_URL}/admin/feedback/${id}/resolve`, {}, {
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },

  // System
  refreshLeaderboard: async () => {
    const response = await axios.post(`${API_URL}/admin/refresh-leaderboard`, {}, {
      headers: { 'X-Admin-Key': getAdminKey() }
    });
    return response.data;
  },
};