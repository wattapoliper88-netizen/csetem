import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://csetem.onrender.com',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const updateAvatar = (avatarImage: string) =>
  api.put('/me/avatar', { avatarImage }).then(r => r.data);

export default api;

export async function getReadUrl(pathOrUrl: string) {
  try {
    // If pathOrUrl already looks like a signed URL with Google parameters, return as-is
    if (pathOrUrl && (pathOrUrl.includes('X-Goog-Signature') || pathOrUrl.includes('GoogleAccessId'))) {
      return pathOrUrl;
    }
    // Call backend endpoint to request fresh read URL
    const body = pathOrUrl.startsWith('http') ? { url: pathOrUrl } : { path: pathOrUrl };
    const res = await api.post('/uploads/read-url', body);
    return res.data?.readUrl;
  } catch (e) {
    console.error('Failed to fetch read URL from backend', e);
    return pathOrUrl; // fallback to the original value
  }
}

export async function getReadUrls(paths: string[]) {
  try {
    const res = await api.post('/uploads/read-urls', { paths });
    return res.data; // Returns Record<string, string | null>
  } catch (e) {
    console.error('Failed to fetch read URLs batch', e);
    return {};
  }
}

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
      if (localStorage.getItem('accessToken')) {
        localStorage.setItem('accessToken', t);
      } else {
        sessionStorage.setItem('accessToken', t);
      }
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
