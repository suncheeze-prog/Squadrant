/* ═══════════════════════════════════════════════════════════════
   USER PROFILE + STATS (Firestore-backed)
   ───────────────────────────────────────────────────────────────
   Documents:
     users/{uid}    = { uid, email, username, usernameLower, wins, losses, createdAt }
     usernames/{usernameLower} = { uid }   ← uniqueness index
   ═══════════════════════════════════════════════════════════════ */
import {
  doc, getDoc, setDoc, updateDoc, increment,
  collection, query, orderBy, limit as fbLimit, getDocs,
  serverTimestamp, runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase.config';

const usernamesCol = collection(db, 'usernames');
const usersCol     = collection(db, 'users');

const normUsername = (u) => String(u || '').trim().toLowerCase();

/** Check if a username is available */
export async function isUsernameAvailable(username) {
  const lower = normUsername(username);
  if (!lower) return false;
  const snap = await getDoc(doc(usernamesCol, lower));
  return !snap.exists();
}

/** Create the user profile + reserve the username (atomic) */
export async function createUserProfile({ uid, email, username }) {
  const lower = normUsername(username);
  if (!lower) throw new Error('Username required');
  await runTransaction(db, async (tx) => {
    const uRef = doc(usernamesCol, lower);
    const uSnap = await tx.get(uRef);
    if (uSnap.exists()) throw new Error('Username already taken');
    tx.set(uRef, { uid });
    tx.set(doc(usersCol, uid), {
      uid, email,
      username: String(username).trim(),
      usernameLower: lower,
      wins: 0, losses: 0,
      createdAt: serverTimestamp(),
    });
  });
}

/** Get a user's profile by uid */
export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(usersCol, uid));
  return snap.exists() ? snap.data() : null;
}

/** Increment wins or losses for a user */
export async function incrementStat(uid, kind) {
  if (!uid || (kind !== 'wins' && kind !== 'losses')) return;
  try {
    await updateDoc(doc(usersCol, uid), { [kind]: increment(1) });
  } catch (e) {
    // Profile may not exist (anonymous fallback) — ignore
    console.warn('incrementStat failed', e);
  }
}

/** Get leaderboard — top N users by wins */
export async function getLeaderboard(n = 50) {
  const q = query(usersCol, orderBy('wins', 'desc'), fbLimit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}
