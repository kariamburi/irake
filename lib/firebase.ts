// lib/firebase.ts
import { getApps, initializeApp, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.authDomain ||
    !firebaseConfig.projectId ||
    !firebaseConfig.storageBucket ||
    !firebaseConfig.messagingSenderId ||
    !firebaseConfig.appId
  ) {
    throw new Error("Missing NEXT_PUBLIC Firebase config");
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

const app = getFirebaseApp();
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export const getAuthSafe = async () => {
  if (typeof window === "undefined") return null;
  const { GoogleAuthProvider } = await import("firebase/auth");
  const googleProvider = new GoogleAuthProvider();
  return { auth, googleProvider };
};

export const getMessagingSafe = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const { getMessaging, getToken } = await import("firebase/messaging");
  const messaging = getMessaging(app);
  return { messaging, getToken };
};

export { app, db, storage, auth };