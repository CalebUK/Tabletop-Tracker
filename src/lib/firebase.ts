import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
} from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from './firebaseConfig';

// getReactNativePersistence ships only in Firebase's React Native build, which
// Metro resolves at runtime; it's absent from the default (browser) typings.
const getReactNativePersistence = (
  FirebaseAuth as unknown as { getReactNativePersistence: (storage: unknown) => any }
).getReactNativePersistence;

// Lazily initialised so the app doesn't touch native storage at launch (the
// Library tab is the only place this is needed). Initialise on first use.
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

function init() {
  if (app) return;
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  // Long polling avoids the streaming transport React Native doesn't support.
  firestore = initializeFirestore(app, { experimentalForceLongPolling: true });
}

export function getFirestoreDb(): Firestore {
  init();
  return firestore!;
}

// Resolve a signed-in (anonymous) user, signing in if needed. Returns the uid.
export function ensureSignedIn(): Promise<string> {
  init();
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth!, async (user) => {
      if (user) {
        unsub();
        resolve(user.uid);
        return;
      }
      try {
        const cred = await signInAnonymously(auth!);
        unsub();
        resolve(cred.user.uid);
      } catch (e) {
        unsub();
        reject(e);
      }
    });
  });
}
