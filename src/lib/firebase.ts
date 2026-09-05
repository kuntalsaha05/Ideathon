import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Firestore,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { JournalInteraction, AuthUserProfile } from "../types";

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Initialize Firestore with custom database ID specified in configuration
const databaseId = (firebaseConfig as any).firestoreDatabaseId || "(default)";
export const db: Firestore = getFirestore(app, databaseId);

/**
 * Strips all undefined properties from any object before passing to Firestore
 * to fulfill Zero-Crash Payload Hygiene.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj, (_key, value) => {
    return value === undefined ? null : value;
  }));
}

/**
 * Sign in using Google Federated Identity
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Google Auth Error:", error);
    throw error;
  }
}

/**
 * Sign out of current session
 */
export async function logOut(): Promise<void> {
  await signOut(auth);
}

/**
 * Sync user profile to /users/{userId} document (isolated)
 */
export async function syncUserProfile(user: FirebaseUser): Promise<void> {
  if (!user || !user.uid) return;
  const userRef = doc(db, "users", user.uid);
  const profileData: AuthUserProfile & { lastLoginAt: string } = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    lastLoginAt: new Date().toISOString(),
  };
  await setDoc(userRef, stripUndefined(profileData), { merge: true });
}

/**
 * Subscribe to user's private reflections under /users/{userId}/interactions
 * Enforces strict user isolation.
 */
export function subscribeUserInteractions(
  userId: string,
  onData: (interactions: JournalInteraction[]) => void,
  onError: (err: Error) => void
): () => void {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const interactionsRef = collection(db, "users", userId, "interactions");
  const q = query(interactionsRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalInteraction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as JournalInteraction;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      onData(items);
    },
    (err) => {
      console.error("Error listening to user interactions:", err);
      onError(err);
    }
  );
}

/**
 * Save a new interaction to Firestore under /users/{userId}/interactions/{interactionId}
 */
export async function persistInteraction(
  userId: string,
  interaction: JournalInteraction
): Promise<void> {
  if (!userId) throw new Error("Authentication required to save interaction.");
  const docRef = doc(db, "users", userId, "interactions", interaction.id);
  const cleanPayload = stripUndefined(interaction);
  await setDoc(docRef, cleanPayload);
}

/**
 * Append a multi-turn conversation turn or update fields
 */
export async function updateInteractionDoc(
  userId: string,
  interactionId: string,
  updates: Partial<JournalInteraction>
): Promise<void> {
  if (!userId || !interactionId) return;
  const docRef = doc(db, "users", userId, "interactions", interactionId);
  const cleanPayload = stripUndefined({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(docRef, cleanPayload);
}

/**
 * Delete a user's interaction
 */
export async function deleteInteractionDoc(
  userId: string,
  interactionId: string
): Promise<void> {
  if (!userId || !interactionId) return;
  const docRef = doc(db, "users", userId, "interactions", interactionId);
  await deleteDoc(docRef);
}
