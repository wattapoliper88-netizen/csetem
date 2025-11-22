import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://csetem-production.up.railway.app',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const updateAvatar = (avatarImage: string) =>
  api.put('/me/avatar', { avatarImage }).then(r => r.data);

export default api;
