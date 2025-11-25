import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://csetem.onrender.com',
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

// Refresh flow: on 401 try to refresh once and retry the request
let isRefreshing = false;
let subscribers: Array<(token: string | null) => void> = [];

function onRefreshed(token: string | null) {
  subscribers.forEach(cb => cb(token));
  subscribers = [];
}

function subscribe(cb: (token: string | null) => void) {
  subscribers.push(cb);
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const r = await axios.post((import.meta.env.VITE_API_URL || 'https://csetem.onrender.com') + '/auth/refresh', {}, { withCredentials: true });
    const t = r.data?.accessToken;
    if (t) {
      localStorage.setItem('accessToken', t);
      api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    }
    return t || null;
  } catch (e) {
    return null;
  }
}

api.interceptors.response.use(
  r => r,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribe((token) => {
            if (token) {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              resolve(api(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        onRefreshed(newToken);
        if (newToken) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (e) {
        isRefreshing = false;
        onRefreshed(null);
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);
