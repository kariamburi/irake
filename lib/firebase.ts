// lib/firebase.ts
import { getApps, getApp, initializeApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
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

function hasFirebaseConfig() {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseConfig()) {
    console.warn("⚠️ Missing NEXT_PUBLIC Firebase config");
    return null;
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getDbSafe() {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}

export function getStorageSafe() {
  const app = getFirebaseApp();
  return app ? getStorage(app) : null;
}

export const getAuthSafe = async () => {
  if (typeof window === "undefined") return null;

  const app = getFirebaseApp();
  if (!app) return null;

  const { getAuth, GoogleAuthProvider } = await import("firebase/auth");
  const auth = getAuth(app);
  const googleProvider = new GoogleAuthProvider();

  return { auth, googleProvider };
};

export const getMessagingSafe = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  const app = getFirebaseApp();
  if (!app) return null;

  const { getMessaging, getToken } = await import("firebase/messaging");
  const messaging = getMessaging(app);
  return { messaging, getToken };
};