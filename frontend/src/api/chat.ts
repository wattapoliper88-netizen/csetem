import api from './client';

export async function getMyConversation() {
  try {
    const res = await api.get('/conversations/me');
    return res.data;
  } catch (err: any) {
    if (err.response?.status === 403) {
      // Admin users calling this endpoint will get 403; treat as null
      return null;
    }
    throw err;
  }
}

export async function listConversations() {
  const res = await api.get('/conversations');
  return res.data;
}

export async function getMessages(conversationId: string) {
  const res = await api.get(`/messages/${conversationId}`, { params: { limit: 50 } });
  return res.data;
}

export async function sendMessage(conversationId: string, content: string) {
  const res = await api.post('/messages', { conversationId, content });
  return res.data;
}

export async function getFolders(conversationId: string) {
  const res = await api.get(`/folders/${conversationId}`);
  return res.data;
}

export async function closeFolder(folderId: string) {
  const res = await api.post(`/folders/${folderId}/close`);
  return res.data;
}

export async function deleteMessages(messageIds: string[]) {
  const res = await api.post('/messages/delete', { messageIds });
  return res.data;
}
