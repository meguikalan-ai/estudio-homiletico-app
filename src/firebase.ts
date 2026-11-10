import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  writeBatch,
  Unsubscribe,
  DocumentReference,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : ({} as Record<string, string>);

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey || env.VITE_FIREBASE_API_KEY || "",
  authDomain: firebaseConfigJson.authDomain || env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: firebaseConfigJson.projectId || env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: firebaseConfigJson.storageBucket || env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: firebaseConfigJson.messagingSenderId || env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: firebaseConfigJson.appId || env.VITE_FIREBASE_APP_ID || "",
  measurementId: firebaseConfigJson.measurementId || env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "" && 
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== ""
);

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

    try {
      // Initialize Firestore using default or specific database ID
      const databaseId = firebaseConfigJson.firestoreDatabaseId;
      if (databaseId && databaseId !== "(default)") {
        dbInstance = getFirestore(app, databaseId);
      } else {
        dbInstance = getFirestore(app);
      }
    } catch (dbErr) {
      console.warn("Firebase Firestore não pôde ser inicializado:", dbErr);
      dbInstance = null;
    }
  } catch (error) {
    console.error("Erro na inicialização do Firebase App:", error);
    app = null;
    dbInstance = null;
  }
}

export const db = dbInstance;
export const firestoreDatabaseId = firebaseConfigJson.firestoreDatabaseId || "(default)";
export const firebaseProjectId = firebaseConfigJson.projectId || "";

export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch
};

export type { Firestore, Unsubscribe, DocumentReference, DocumentData, QuerySnapshot };

