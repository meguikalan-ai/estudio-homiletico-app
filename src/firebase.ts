import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  browserLocalPersistence,
  setPersistence,
  User,
  Auth
} from 'firebase/auth';
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
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || "",
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId || "",
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId || "",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId || ""
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "" && 
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== ""
);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    try {
      authInstance = getAuth(app);
      // Garantir persistência de sessão entre aberturas no navegador, celular e PWA
      setPersistence(authInstance, browserLocalPersistence).catch((err) => {
        console.warn("Aviso ao definir persistência local do Firebase Auth:", err);
      });
    } catch (authErr) {
      console.warn("Firebase Auth não pôde ser inicializado:", authErr);
      authInstance = null;
    }

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
    authInstance = null;
    dbInstance = null;
  }
}

export const auth = authInstance;
export const db = dbInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const firestoreDatabaseId = firebaseConfigJson.firestoreDatabaseId || "(default)";
export const firebaseProjectId = firebaseConfigJson.projectId || "";

export {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
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

export type { User, Firestore, Unsubscribe, DocumentReference, DocumentData, QuerySnapshot };

