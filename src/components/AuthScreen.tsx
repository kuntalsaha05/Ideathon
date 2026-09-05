import React, { useState } from "react";
import { signInWithGoogle } from "../lib/firebase";
import { Lock, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      let message = "Failed to complete Google Sign-In. Please try again.";
      if (err?.code === "auth/popup-blocked") {
        message = "Popup was blocked by your browser. Please allow popups or open in a new tab.";
      } else if (err?.code === "auth/popup-closed-by-user") {
        message = "Sign-in popup was closed before completion.";
      } else if (err?.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600 opacity-[0.04] blur-[150px] pointer-events-none rounded-full" />

      {/* Top Navigation Bar */}
      <header className="w-full border-b border-[#ffffff0a] bg-[#0a0a0c]/80 backdrop-blur-xl px-6 sm:px-10 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
          <div>
            <span className="font-serif italic text-white tracking-wide text-base block">
              Gemini Journal
            </span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#555] font-semibold">
              Cognitive Archive
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-[#666] bg-white/[0.02] px-3 py-1.5 rounded-lg border border-white/5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>FIRESTORE USER-ISOLATED</span>
        </div>
      </header>

      {/* Hero Centerpiece */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col lg:flex-row items-center justify-center gap-12 sm:gap-16 z-10">
        {/* Left Value Proposition */}
        <div className="flex-1 space-y-7 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-mono uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>Gemini 3.6 Flash & Cloud Firestore</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif italic text-white tracking-tight leading-[1.2]">
            A private space for thoughts, reflections, and clarity.
          </h1>

          <p className="text-base sm:text-lg text-[#888] leading-relaxed max-w-xl font-sans">
            Speak into the void. Unburden your stream of consciousness, explore decisions, and converse with Gemini to synthesize themes, creative ideas, and cognitive clarity.
          </p>

          {/* Privacy Guarantees */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-sm">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#bbb]">
                User-Isolated Firestore
              </h3>
              <p className="text-xs text-[#666] mt-1.5 leading-relaxed">
                Security rules strictly enforce that only your authenticated Google account can read or write your personal entries.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-sm">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                <span className="text-xs font-serif font-bold text-blue-400">AI</span>
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#bbb]">
                Multi-Turn Dialogue
              </h3>
              <p className="text-xs text-[#666] mt-1.5 leading-relaxed">
                Deepen insights across multi-turn conversations with resilient model fallbacks and persistent dialogue history.
              </p>
            </div>
          </div>
        </div>

        {/* Right Authentication Card */}
        <div className="w-full max-w-md">
          <div className="bg-[#0f0f12]/90 rounded-2xl border border-white/10 shadow-2xl shadow-black/80 p-8 space-y-6 backdrop-blur-xl">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 text-blue-400 flex items-center justify-center shadow-lg">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-serif italic text-white tracking-wide">
                Sign in to your journal
              </h2>
              <p className="text-xs text-[#777]">
                Federated authentication with your Google account via Firebase.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block mb-0.5">Authentication Notice:</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Google Sign-in CTA */}
            <button
              id="google-signin-button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 px-6 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:bg-white/15 text-white font-medium text-sm flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2 text-[#aaa]">
                  <div className="w-4 h-4 border-2 border-[#555] border-t-white rounded-full animate-spin" />
                  <span>Connecting with Google...</span>
                </div>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with Google</span>
                  <ArrowRight className="w-4 h-4 text-[#666] ml-auto" />
                </>
              )}
            </button>

            <div className="pt-2 border-t border-white/5 text-center">
              <p className="text-[11px] text-[#555] leading-relaxed">
                By signing in, you access your private Firestore storage bucket. Federated authentication eliminates credential handling risk.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#ffffff0a] py-4 px-6 text-center text-[10px] font-mono text-[#444] uppercase tracking-widest z-10">
        Google AI Studio &bull; Cloud Firestore &bull; Gemini 3.6 Flash &bull; Private Introspection
      </footer>
    </div>
  );
};
