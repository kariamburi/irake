// /lib/firebaseAdmin.ts
import { getApps, getApp, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

function getEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  return { projectId, clientEmail, privateKey };
}

export function getAdminDb(): Firestore {
  const { projectId, clientEmail, privateKey } = getEnv();

  if (!projectId || !clientEmail || !privateKey) {
    // This stops build from crashing and lets API route return a friendly error.
    throw new Error("Missing Firebase Admin env vars");
  }

  const app: App =
    getApps().length
      ? getApp()
      : initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });

  return getFirestore(app);
}
