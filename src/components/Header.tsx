import React from "react";
import { AuthUserProfile } from "../types";
import { logOut } from "../lib/firebase";
import { LogOut, Plus, Menu } from "lucide-react";

interface HeaderProps {
  user: AuthUserProfile;
  onNewReflection: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onNewReflection,
  onToggleSidebar,
}) => {
  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <header className="h-16 border-b border-[#ffffff0a] backdrop-blur-xl bg-[#0a0a0c]/80 sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between">
      {/* Left: Brand & Mobile Menu toggle */}
      <div className="flex items-center gap-3 sm:gap-6">
        {onToggleSidebar && (
          <button
            id="toggle-sidebar-button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-[#666] hover:bg-white/5 hover:text-white transition-colors"
            title="Toggle entries list"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
          <div>
            <h1 className="text-base sm:text-lg font-serif italic text-white tracking-wide leading-tight">
              Gemini Journal
            </h1>
            <p className="text-[9px] uppercase tracking-[0.2em] text-[#555] font-semibold hidden sm:block">
              Cognitive Archive
            </p>
          </div>
        </div>

        {/* Isolation status indicator from Sophisticated Dark design */}
        <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-[#ffffff0a]">
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#666]">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/70 animate-pulse" />
            <span>FIRESTORE CONNECTED</span>
          </div>
          <div className="h-3 w-px bg-[#ffffff10]" />
          <span className="text-[11px] font-mono text-[#555] uppercase tracking-wider">
            UID: {user.uid.slice(0, 8)}...
          </span>
        </div>
      </div>

      {/* Right: New Reflection & User Profile & Sign Out */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          id="new-reflection-header-btn"
          onClick={onNewReflection}
          className="px-3.5 sm:px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-blue-600/90 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Reflection</span>
        </button>

        {/* User profile dropdown / preview */}
        <div className="flex items-center gap-3 pl-3 border-l border-[#ffffff0a]">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "User avatar"}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#222] to-[#444] border border-[#ffffff15] flex items-center justify-center">
              <span className="text-xs font-serif text-white">
                {(user.displayName || user.email || "U").slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}

          <div className="hidden md:block text-left max-w-[130px]">
            <p className="text-xs font-semibold text-white truncate">
              {user.displayName || "Authenticated"}
            </p>
            <p className="text-[10px] text-[#555] font-mono truncate" title={user.email || ""}>
              {user.email || user.uid.slice(0, 8)}
            </p>
          </div>

          <button
            id="signout-button"
            onClick={handleSignOut}
            title="Sign Out"
            className="p-1.5 text-[#555] hover:text-white transition-colors cursor-pointer rounded-md hover:bg-white/5"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
