// /lib/firebaseAdmin.ts
import { getApps, getApp, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

export function getAdminDb(): Firestore {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    // IMPORTANT: don't initialize if missing; let the caller handle it
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
