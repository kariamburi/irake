import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ✅ Initialize Firebase safely (only once)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// ✅ Services safe on server + client
const db = getFirestore(app);
const storage = getStorage(app);

// ⚠️ Browser-only services (must be imported lazily)
export const getAuthSafe = async () => {
  if (typeof window === "undefined") return null; // don’t run on server
  const { getAuth, GoogleAuthProvider } = await import("firebase/auth");
  const auth = getAuth(app);
  const googleProvider = new GoogleAuthProvider();
  return { auth, googleProvider };
};

export const getMessagingSafe = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const { getMessaging, getToken } = await import("firebase/messaging");
  const messaging = getMessaging(app);
  return { messaging, getToken };
};

export { app, db, storage };
