import api from './client';

const formHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };

function toFormBody(payload: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => params.append(key, value));
  return params.toString();
}

export async function register(payload: { email: string; username: string; password: string }) {
  const res = await api.post('/auth/register', toFormBody(payload), { headers: formHeaders });
  return res.data;
}

export async function verifyCode(payload: { email: string; code: string }) {
  const res = await api.post('/auth/verify', toFormBody(payload), { headers: formHeaders });
  return res.data;
}

export async function login(payload: { username: string; password: string }) {
  const res = await api.post('/auth/login', toFormBody(payload), { headers: formHeaders });
  return res.data;
}

export async function getMe() {
  const res = await api.get('/me');
  return res.data;
}
