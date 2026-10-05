import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Google sign-in needs the Firebase web config in client/.env */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Initialised on first use: getAuth() throws when the API key is missing,
// and doing that at import time blanked the whole app instead of just the Google button.
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(initializeApp(firebaseConfig));
  }
  return auth;
}

/** Opens the Google account picker and returns a Firebase ID token for our backend. */
export async function getGoogleIdToken() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(getFirebaseAuth(), provider);
  const idToken = await user.getIdToken();
  // Our backend issues the real session; don't leave a separate Firebase one behind
  await signOut(getFirebaseAuth());
  return idToken;
}

/** Friendly text for Firebase errors; null means the user simply cancelled. */
export function firebaseErrorMessage(err: unknown): string | null {
  switch ((err as { code?: string })?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a while and try again.';
    case 'auth/unauthorized-domain':
      return 'This website isn’t allowed in Firebase yet (Authentication → Settings → Authorized domains).';
    case 'auth/operation-not-allowed':
      return 'Google sign-in isn’t turned on in Firebase yet (Authentication → Sign-in method).';
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
