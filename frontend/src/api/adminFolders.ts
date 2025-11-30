import api from './client';

export async function listUserFolders() {
  const res = await api.get('/me/admin/user-folders');
  return res.data;
}

export async function createUserFolder(payload: { name: string; parentId?: string; thumbnail?: string | null }) {
  const res = await api.post('/me/admin/user-folders', payload);
  return res.data;
}

export async function updateUserFolder(folderId: string, payload: { name?: string; thumbnail?: string | null }) {
  const res = await api.put(`/me/admin/user-folders/${folderId}`, payload);
  return res.data;
}

export async function deleteUserFolder(folderId: string) {
  const res = await api.delete(`/me/admin/user-folders/${folderId}`);
  return res.data;
}

export async function assignUserToFolder(folderId: string, userId: string) {
  const res = await api.post(`/me/admin/user-folders/${folderId}/users/${userId}`);
  return res.data;
}

export async function unassignUserFromFolder(folderId: string, userId: string) {
  const res = await api.delete(`/me/admin/user-folders/${folderId}/users/${userId}`);
  return res.data;
}
