import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadFile(file) {
  // egyedi fájlnév
  const fileRef = ref(storage, `uploads/${Date.now()}_${file.name}`);

  // fájl feltöltés Storage-be
  await uploadBytes(fileRef, file);

  // URL lekérése
  const url = await getDownloadURL(fileRef);

  return url; // ezt küldöd vissza az API-nak / chat üzenetbe
}
