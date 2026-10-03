import { initializeApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialised on first use: getAuth() throws when the API key is missing,
// and doing that at import time blanked the whole app instead of just phone login.
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(initializeApp(firebaseConfig));
  }
  return auth;
}

export { RecaptchaVerifier, signInWithPhoneNumber };
