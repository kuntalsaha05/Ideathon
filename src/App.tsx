import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  auth,
  syncUserProfile,
  subscribeUserInteractions,
  deleteInteractionDoc,
} from "./lib/firebase";
import { AuthUserProfile, JournalInteraction } from "./types";
import { AuthScreen } from "./components/AuthScreen";
import { Header } from "./components/Header";
import { EntriesHistory } from "./components/EntriesHistory";
import { JournalWorkspace } from "./components/JournalWorkspace";
import { AlertCircle } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<JournalInteraction[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [activeEntry, setActiveEntry] = useState<JournalInteraction | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Monitor Firebase Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userProfile: AuthUserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        setCurrentUser(userProfile);
        try {
          await syncUserProfile(user);
        } catch (e) {
          console.warn("Could not sync user profile:", e);
        }
      } else {
        setCurrentUser(null);
        setEntries([]);
        setActiveEntry(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore Entries for Authenticated User
  useEffect(() => {
    if (!currentUser?.uid) {
      setEntries([]);
      setEntriesLoading(false);
      return;
    }

    setEntriesLoading(true);
    setFirestoreError(null);

    const unsubscribe = subscribeUserInteractions(
      currentUser.uid,
      (data) => {
        setEntries(data);
        setEntriesLoading(false);

        // Keep active entry updated if it was edited or appended to
        setActiveEntry((prev) => {
          if (!prev) return null;
          const matched = data.find((item) => item.id === prev.id);
          return matched || prev;
        });
      },
      (err) => {
        console.error("Firestore subscription error:", err);
        setFirestoreError(
          `Unable to load interactions from Firestore: ${err.message || "Permission or network issue"}`
        );
        setEntriesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Handle entry deletion
  const handleDeleteEntry = async (entryId: string) => {
    if (!currentUser?.uid) return;
    try {
      await deleteInteractionDoc(currentUser.uid, entryId);
      if (activeEntry?.id === entryId) {
        setActiveEntry(null);
      }
    } catch (err: any) {
      console.error("Failed to delete entry:", err);
      alert(`Could not delete entry: ${err?.message || "Unknown error"}`);
    }
  };

  // When a user selects an entry from history
  const handleSelectEntry = (entry: JournalInteraction) => {
    setActiveEntry(entry);
    setSidebarOpen(false); // Auto close sidebar on mobile
  };

  // Start a new reflection
  const handleStartNew = () => {
    setActiveEntry(null);
    setSidebarOpen(false);
  };

  // When a new entry is saved or updated
  const handleEntrySaved = (savedEntry: JournalInteraction) => {
    setActiveEntry(savedEntry);
  };

  // Initial Auth Loading Spinner in Sophisticated Dark
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-6 text-[#e0e0e0]">
        <div className="relative mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#0f0f12] border border-white/10 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-pulse" />
          </div>
        </div>
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#666]">
          Verifying Identity & Firestore...
        </p>
      </div>
    );
  }

  // If Not Authenticated -> Show Sophisticated Dark Landing Page & Sign In Flow
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  // Authenticated Dashboard with Sophisticated Dark theme
  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col text-[#e0e0e0] font-sans relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600 opacity-[0.03] blur-[140px] pointer-events-none rounded-full" />

      {/* Top Application Header */}
      <Header
        user={currentUser}
        onNewReflection={handleStartNew}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        isSidebarOpen={sidebarOpen}
      />

      {/* Firestore Alert if any */}
      {firestoreError && (
        <div className="bg-red-950/40 border-b border-red-500/20 px-6 py-2.5 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{firestoreError}</span>
        </div>
      )}

      {/* Main App Body */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Desktop Sidebar / Mobile Drawer */}
        <div
          className={`fixed inset-y-0 left-0 top-16 z-30 md:static md:block transition-transform duration-200 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <EntriesHistory
            entries={entries}
            activeEntryId={activeEntry?.id || null}
            onSelectEntry={handleSelectEntry}
            onNewEntry={handleStartNew}
            onDeleteEntry={handleDeleteEntry}
            loading={entriesLoading}
          />
        </div>

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-20 md:hidden top-16"
          />
        )}

        {/* Center Workspace */}
        <JournalWorkspace
          user={currentUser}
          activeEntry={activeEntry}
          onEntrySaved={handleEntrySaved}
          onStartNew={handleStartNew}
        />
      </div>
    </div>
  );
}
