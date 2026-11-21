/* ═══════════════════════════════════════════════════════════════
   FIREBASE CONFIGURATION + AUTH HELPERS
   ═══════════════════════════════════════════════════════════════ */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyBr9RCDvZUVl1cb7Syac5GBp8iLJc-stWs",
  authDomain:        "squadrant-630b7.firebaseapp.com",
  projectId:         "squadrant-630b7",
  storageBucket:     "squadrant-630b7.firebasestorage.app",
  messagingSenderId: "501050892161",
  appId:             "1:501050892161:web:325d05f5443adcc23b1280",
  measurementId:     "G-1D6HQHS8DC",
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

export const onlineAvailable = () => true;

// ── Auth helpers ────────────────────────────────────────────────

/** Wait for the current auth state (resolved once) */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (user) => { off(); resolve(user); });
  });
}

/** Subscribe to auth changes — returns unsub */
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Sign up with email + password. Sets displayName to username. */
export async function signUp({ email, password, username }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  try { await updateProfile(cred.user, { displayName: username }); } catch (e) {}
  return cred.user;
}

/** Sign in with email + password */
export async function signIn({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/** Send password reset email — user clicks link in email to reset */
export async function sendResetEmail(email) {
  await sendPasswordResetEmail(auth, email);
}

/** Sign out */
export async function signOut() { await fbSignOut(auth); }
