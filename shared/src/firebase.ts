/// <reference types="vite/client" />
/**
 * Firebase client bootstrap connected to megazone-21310.
 * Supports environment overrides via VITE_FIREBASE_* variables.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

const cleanEnv = (val: string | undefined): string =>
  (val ?? "").trim().replace(/^["']|["']$/g, "");

const firebaseConfig = {
  apiKey: cleanEnv(env.VITE_FIREBASE_API_KEY) || "AIzaSyBTCzyVuCiXwobTXBIo0JVF70pL7Om8Whg",
  authDomain: cleanEnv(env.VITE_FIREBASE_AUTH_DOMAIN) || "megazone-21310.firebaseapp.com",
  projectId: cleanEnv(env.VITE_FIREBASE_PROJECT_ID) || "megazone-21310",
  storageBucket: cleanEnv(env.VITE_FIREBASE_STORAGE_BUCKET) || "megazone-21310.firebasestorage.app",
  messagingSenderId: cleanEnv(env.VITE_FIREBASE_MESSAGING_SENDER_ID) || "885441648307",
  appId: cleanEnv(env.VITE_FIREBASE_APP_ID) || "1:885441648307:web:135009131ed765e44442c6",
};

const configured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.storageBucket &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;
let appCheck: AppCheck | null = null;

if (configured) {
  try {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app, "asia-south1");
    const recaptchaSiteKey = cleanEnv(env.VITE_RECAPTCHA_V3_SITE_KEY);
    if (recaptchaSiteKey && typeof window !== "undefined") {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err) {
    console.error("Firebase initialization error:", err);
  }
}

export { app, auth, db, storage, functions, appCheck, configured, firebaseConfig };
