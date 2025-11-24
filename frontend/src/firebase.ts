import api from './api/client';

// uploadFileToFirebase: use server-generated signed upload URL to PUT file to Firebase Storage.
// This avoids direct client POST to googleapis which can trigger CORS issues.
export async function uploadFileToFirebase(file: File, path: string, onProgress?: (pct: number) => void) {
  // Request a signed upload URL from backend
  const resp = await api.post('/uploads/signed-url', { path, contentType: file.type });
  if (resp.data?.error) throw new Error(resp.data.error);
  const uploadUrl: string = resp.data.uploadUrl;
  const bucket = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'web-chat-data.appspot.com');

  // Use fetch to PUT the file to the signed URL
  const xhr = new XMLHttpRequest();
  return await new Promise<string>((resolve, reject) => {
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Construct a download URL for use in the app. This URL may require proper storage rules.
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
        resolve(downloadUrl);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

export default null;
