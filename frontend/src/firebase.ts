import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// Firebase config - keep this in sync with your environment or replace with env var import
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAPcFuMvwOslMHL8YtTrTTs_5nksjiqhh8',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'web-chat-data.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'web-chat-data',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'web-chat-data.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '235670309696',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:235670309696:web:788a8e0ac3b9dcf0b1c8a5'
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

export async function uploadFileToFirebase(file: File, path: string, onProgress?: (pct: number) => void) {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise<string>((resolve, reject) => {
    uploadTask.on('state_changed',
      (snapshot) => {
        if (onProgress) {
          const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(Math.round(pct));
        }
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(storageRef);
        resolve(url);
      }
    );
  });
}

export default storage;
