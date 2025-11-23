import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAPcFuMvwOslMHL8YtTrTTs_5nksjiqhh8",
  authDomain: "web-chat-data.firebaseapp.com",
  projectId: "web-chat-data",
  storageBucket: "web-chat-data.firebasestorage.app",
  messagingSenderId: "235670309696",
  appId: "1:235670309696:web:788a8e0ac3b9dcf0b1c8a5"
};

const app = initializeApp(firebaseConfig);

export const storage = getStorage(app);
