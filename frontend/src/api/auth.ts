import api from './client';

export async function register(payload: { email: string; username: string; password: string }) {
  const res = await api.post('/auth/register', payload);
  return res.data;
}

export async function verifyCode(payload: { email: string; code: string }) {
  const res = await api.post('/auth/verify', payload);
  return res.data;
}

export async function login(payload: { username: string; password: string }) {
  const res = await api.post('/auth/login', payload);
  return res.data;
}

export async function getMe() {
  const res = await api.get('/me');
  return res.data;
}
