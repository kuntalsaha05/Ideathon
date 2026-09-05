import React, { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import {
  JournalInteraction,
  ReflectionMode,
  ConversationTurn,
  AuthUserProfile,
} from "../types";
import { requestGeminiReflection } from "../lib/geminiApi";
import { persistInteraction, updateInteractionDoc } from "../lib/firebase";
import {
  Sparkles,
  FileText,
  Lightbulb,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  User as UserIcon,
  HelpCircle,
} from "lucide-react";

interface JournalWorkspaceProps {
  user: AuthUserProfile;
  activeEntry: JournalInteraction | null;
  onEntrySaved: (entry: JournalInteraction) => void;
  onStartNew: () => void;
}

const PROMPT_SUGGESTIONS = [
  {
    title: "Daily Friction",
    text: "Today was intense. Here is what gave me energy and what drained me:",
    mode: "reflect" as ReflectionMode,
  },
  {
    title: "Decision Dilemma",
    text: "I am trying to make a tough decision between two options:",
    mode: "brainstorm" as ReflectionMode,
  },
  {
    title: "Quarterly Review",
    text: "Here is a stream of consciousness of everything accomplished recently:",
    mode: "summarize" as ReflectionMode,
  },
];

export const JournalWorkspace: React.FC<JournalWorkspaceProps> = ({
  user,
  activeEntry,
  onEntrySaved,
  onStartNew,
}) => {
  // New reflection form state
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<ReflectionMode>("reflect");

  // Multi-turn follow-up state
  const [replyText, setReplyText] = useState("");

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copied, setCopied] = useState(false);

  // Failed payload backup for Retry Save
  const [failedPayload, setFailedPayload] = useState<{
    type: "new" | "reply";
    data: any;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Set default title when starting a new entry
  useEffect(() => {
    if (!activeEntry) {
      const now = new Date();
      const defaultTitle = `Reflection on ${now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} • ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      setTitle(defaultTitle);
      setPrompt("");
      setMode("reflect");
      setErrorMessage(null);
      setSaveStatus("idle");
      setFailedPayload(null);
    } else {
      setTitle(activeEntry.title);
      setMode(activeEntry.category);
      setErrorMessage(null);
      setSaveStatus("saved");
      setFailedPayload(null);
    }
  }, [activeEntry]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (activeEntry && activeEntry.turns && activeEntry.turns.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeEntry?.turns, isGenerating]);

  // Handle submitting a brand new reflection
  const handleCreateReflection = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setErrorMessage("Please enter your reflection before submitting.");
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);
    setSaveStatus("saving");

    try {
      // 1. Request AI completion with fallback ladder
      const aiResult = await requestGeminiReflection(trimmedPrompt, mode, []);

      // 2. Formulate complete interaction payload
      const interactionId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const newInteraction: JournalInteraction = {
        id: interactionId,
        userId: user.uid,
        title: title.trim() || `Reflection on ${new Date().toLocaleDateString()}`,
        category: mode,
        prompt: trimmedPrompt,
        response: aiResult.text,
        modelUsed: aiResult.modelUsed || "gemini-3.6-flash",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        turns: [],
      };

      // 3. Guaranteed Transaction Verification: Save to Cloud Firestore
      try {
        await persistInteraction(user.uid, newInteraction);
        setSaveStatus("saved");
        setFailedPayload(null);
        onEntrySaved(newInteraction);
      } catch (dbErr: any) {
        console.error("Firestore persistence error:", dbErr);
        setSaveStatus("error");
        setFailedPayload({ type: "new", data: newInteraction });
        setErrorMessage(
          `AI reflection completed, but saving to Firestore failed: ${dbErr?.message || "Permission error"}. Your reflection is safe below. Click 'Retry Save' to store it.`
        );
      }
    } catch (apiErr: any) {
      console.error("Gemini Generation Error:", apiErr);
      setSaveStatus("error");
      setErrorMessage(
        apiErr?.message || "Failed to generate reflection with Gemini. Please try again."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle submitting a follow-up reply in multi-turn conversation
  const handleSendReply = async () => {
    if (!activeEntry) return;
    const trimmedReply = replyText.trim();
    if (!trimmedReply) return;

    setErrorMessage(null);
    setIsGenerating(true);
    setSaveStatus("saving");

    // Construct user turn
    const userTurnId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `turn_u_${Date.now()}`;
    const newUserTurn: ConversationTurn = {
      id: userTurnId,
      role: "user",
      content: trimmedReply,
      timestamp: new Date().toISOString(),
    };

    // Prepare full conversation history for context
    const fullHistory: ConversationTurn[] = [
      {
        id: "orig_u",
        role: "user",
        content: activeEntry.prompt,
        timestamp: activeEntry.createdAt,
      },
      {
        id: "orig_m",
        role: "model",
        content: activeEntry.response,
        timestamp: activeEntry.createdAt,
      },
      ...(activeEntry.turns || []),
    ];

    try {
      // 1. Request AI completion with conversation history
      const aiResult = await requestGeminiReflection(
        trimmedReply,
        activeEntry.category,
        fullHistory
      );

      // Model turn
      const modelTurnId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `turn_m_${Date.now()}`;
      const newModelTurn: ConversationTurn = {
        id: modelTurnId,
        role: "model",
        content: aiResult.text,
        timestamp: new Date().toISOString(),
      };

      const updatedTurns = [...(activeEntry.turns || []), newUserTurn, newModelTurn];

      // 2. Guaranteed Transaction Verification: Update Firestore document
      try {
        await updateInteractionDoc(user.uid, activeEntry.id, {
          turns: updatedTurns,
          modelUsed: aiResult.modelUsed || activeEntry.modelUsed,
        });

        // Update local object
        const updatedEntry: JournalInteraction = {
          ...activeEntry,
          turns: updatedTurns,
          modelUsed: aiResult.modelUsed || activeEntry.modelUsed,
          updatedAt: new Date().toISOString(),
        };

        setReplyText("");
        setSaveStatus("saved");
        setFailedPayload(null);
        onEntrySaved(updatedEntry);
      } catch (dbErr: any) {
        console.error("Failed to update Firestore document with follow-up turns:", dbErr);
        setSaveStatus("error");
        setFailedPayload({
          type: "reply",
          data: {
            entryId: activeEntry.id,
            updatedTurns,
          },
        });
        setErrorMessage(
          `Gemini responded, but saving the follow-up turn to Firestore failed: ${dbErr?.message}. Click 'Retry Save' to store it permanently.`
        );
      }
    } catch (apiErr: any) {
      console.error("Gemini Multi-Turn Error:", apiErr);
      setSaveStatus("error");
      setErrorMessage(
        apiErr?.message || "Failed to generate follow-up reply with Gemini. Your text has been preserved."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Retry failed Firestore save
  const handleRetrySave = async () => {
    if (!failedPayload) return;
    setSaveStatus("saving");
    try {
      if (failedPayload.type === "new") {
        await persistInteraction(user.uid, failedPayload.data);
        onEntrySaved(failedPayload.data);
      } else if (failedPayload.type === "reply") {
        await updateInteractionDoc(user.uid, failedPayload.data.entryId, {
          turns: failedPayload.data.updatedTurns,
        });
        if (activeEntry) {
          onEntrySaved({
            ...activeEntry,
            turns: failedPayload.data.updatedTurns,
          });
        }
      }
      setSaveStatus("saved");
      setFailedPayload(null);
      setErrorMessage(null);
    } catch (err: any) {
      console.error("Retry save failed:", err);
      setSaveStatus("error");
      setErrorMessage(`Retry failed: ${err?.message || "Database write rejected"}`);
    }
  };

  // Copy markdown to clipboard
  const handleCopy = () => {
    if (!activeEntry) return;
    const conversationText = [
      `# ${activeEntry.title}`,
      `Date: ${new Date(activeEntry.createdAt).toLocaleString()}`,
      `Mode: ${activeEntry.category}`,
      `\n## Original Reflection\n${activeEntry.prompt}`,
      `\n## Gemini Response (${activeEntry.modelUsed})\n${activeEntry.response}`,
      ...(activeEntry.turns || []).map(
        (turn) =>
          `\n### ${turn.role === "user" ? "You" : "Gemini"}\n${turn.content}`
      ),
    ].join("\n\n");

    navigator.clipboard.writeText(conversationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#0a0a0c] text-[#e0e0e0] overflow-hidden relative">
      {/* Top Banner / Error Status Notification */}
      {errorMessage && (
        <div className="bg-red-950/40 border-b border-red-500/20 px-6 py-3 flex items-center justify-between text-xs text-red-200 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          {failedPayload && (
            <button
              id="retry-save-btn"
              onClick={handleRetrySave}
              className="px-3 py-1 rounded-lg bg-red-600/80 text-white font-medium text-xs hover:bg-red-500 transition-colors cursor-pointer shrink-0 ml-4"
            >
              Retry Save
            </button>
          )}
        </div>
      )}

      {/* Main Workspace Area */}
      {!activeEntry ? (
        /* ================= NEW REFLECTION VIEW (Sophisticated Dark) ================= */
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 max-w-3xl mx-auto w-full z-10">
          <div className="bg-white/[0.02] rounded-2xl border border-white/[0.05] backdrop-blur-md shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
              <div>
                <h2 className="text-xl font-serif italic text-white tracking-wide">
                  New Reflection
                </h2>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-semibold mt-0.5">
                  Cognitive Intake
                </p>
              </div>

              {/* Mode Selection Pills */}
              <div className="flex items-center gap-1 p-1 bg-[#121216] rounded-xl border border-white/10 text-xs">
                {(
                  [
                    {
                      id: "reflect",
                      label: "Reflect",
                      icon: Sparkles,
                      tooltip: "Deep introspection & inquiry",
                    },
                    {
                      id: "summarize",
                      label: "Summarize",
                      icon: FileText,
                      tooltip: "Key themes & takeaways",
                    },
                    {
                      id: "brainstorm",
                      label: "Brainstorm",
                      icon: Lightbulb,
                      tooltip: "Creative solutions & ideas",
                    },
                  ] as const
                ).map((m) => {
                  const Icon = m.icon;
                  const isCurrent = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      title={m.tooltip}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-white/10 text-white shadow-xs border border-white/10"
                          : "text-[#666] hover:text-[#bbb]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="reflection-title-input"
                className="text-[11px] font-mono uppercase tracking-wider text-[#666] block"
              >
                Session Title
              </label>
              <input
                id="reflection-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name this cognitive session..."
                className="w-full h-10 px-4 rounded-xl bg-[#121216] border border-white/10 text-sm text-[#eee] placeholder:text-[#444] focus:outline-none focus:border-blue-500/40 transition-all font-sans"
              />
            </div>

            {/* Quick Inspiration Starters */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#555]">
                <HelpCircle className="w-3 h-3" />
                <span>Prompt Invocations:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PROMPT_SUGGESTIONS.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPrompt((prev) => (prev ? `${prev}\n\n${sug.text}` : sug.text));
                      setMode(sug.mode);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-[#888] hover:text-[#eee] transition-all cursor-pointer text-left"
                  >
                    <span className="font-semibold text-white/90">{sug.title}</span> &ndash;{" "}
                    <span className="text-[#555] italic">"{sug.text.slice(0, 28)}..."</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Reflection Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="reflection-prompt-input"
                  className="text-[11px] font-mono uppercase tracking-wider text-[#666]"
                >
                  Speak Into The Void
                </label>
                <span className="text-[10px] font-mono text-[#444]">
                  {prompt.length.toLocaleString()} / 15,000 chars
                </span>
              </div>
              <textarea
                id="reflection-prompt-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="I've been feeling a strange resistance to finishing... Write freely and unburden your thoughts."
                rows={9}
                className="w-full p-5 rounded-2xl bg-[#121216] border border-white/10 text-[15px] text-[#eee] placeholder:text-[#333] focus:outline-none focus:border-blue-500/40 transition-all resize-y leading-relaxed font-sans shadow-inner"
              />
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#555] uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Encrypted • Isolated to your UID</span>
              </div>

              <button
                id="submit-reflection-btn"
                onClick={handleCreateReflection}
                disabled={isGenerating || !prompt.trim()}
                className="h-11 px-6 rounded-xl bg-blue-600/90 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Processing with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                    <span>Reflect with Gemini</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ================= EXISTING REFLECTION & MULTI-TURN VIEW (Sophisticated Dark) ================= */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Active Entry Header */}
          <header className="h-16 flex items-center justify-between px-6 sm:px-10 border-b border-[#ffffff0a] backdrop-blur-xl bg-[#0a0a0c]/60 shrink-0 z-20">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#555]">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse" />
                FIRESTORE CONNECTED
              </div>
              <div className="h-3 w-px bg-[#ffffff10]" />
              <span className="text-xs font-medium text-[#aaa] tracking-wide line-clamp-1 max-w-[280px] sm:max-w-md">
                {activeEntry.title}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                id="copy-entry-btn"
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest border border-[#ffffff10] hover:bg-white/5 text-[#888] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                title="Copy reflection as Markdown"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? "Copied" : "Export"}</span>
              </button>

              <button
                id="start-new-from-entry-btn"
                onClick={onStartNew}
                className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest bg-blue-600/90 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>
          </header>

          {/* Conversation Feed */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-12 space-y-12">
            <div className="max-w-2xl mx-auto space-y-10">
              {/* Original User Reflection (Styled with Serif Elegance from theme) */}
              <div className="group space-y-4">
                <div className="flex items-center gap-3 opacity-30 group-hover:opacity-70 transition-opacity">
                  <span className="text-[10px] font-mono tracking-widest uppercase">
                    TIMESTAMP {new Date(activeEntry.createdAt).toLocaleTimeString()}
                  </span>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                </div>
                <p className="text-lg sm:text-xl font-serif leading-[1.7] text-[#bbb] indent-8 whitespace-pre-wrap">
                  {activeEntry.prompt}
                </p>
              </div>

              {/* Gemini Intelligence Response Card */}
              <div className="relative p-7 sm:p-8 rounded-2xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm space-y-5 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-400">
                      Gemini Intelligence
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#444] uppercase tracking-wider">
                    {activeEntry.modelUsed || "3.6 FLASH"}
                  </span>
                </div>

                <div className="markdown-body text-[15px] text-[#999] leading-relaxed">
                  <Markdown>{activeEntry.response}</Markdown>
                </div>

                <div className="flex gap-2 pt-1 border-t border-white/[0.04]">
                  <span className="px-2 py-0.5 rounded border border-white/10 text-[9px] uppercase font-bold text-[#666] tracking-tighter">
                    Analysis Complete
                  </span>
                  <span className="px-2 py-0.5 rounded border border-white/10 text-[9px] uppercase font-bold text-[#666] tracking-tighter">
                    {activeEntry.category.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Multi-turn turns history */}
              {activeEntry.turns &&
                activeEntry.turns.map((turn) => {
                  const isUser = turn.role === "user";
                  return (
                    <div key={turn.id} className="space-y-3">
                      {isUser ? (
                        <div className="group space-y-3 pl-4 border-l border-white/10">
                          <div className="flex items-center gap-3 opacity-40 group-hover:opacity-70 transition-opacity">
                            <span className="text-[9px] font-mono tracking-widest text-[#666] uppercase">
                              FOLLOW-UP • {new Date(turn.timestamp).toLocaleTimeString()}
                            </span>
                            <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                          </div>
                          <p className="text-base font-serif leading-[1.7] text-[#ccc] whitespace-pre-wrap">
                            {turn.content}
                          </p>
                        </div>
                      ) : (
                        <div className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm space-y-4 shadow-xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/80" />
                              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">
                                Gemini Perspective
                              </span>
                            </div>
                            <span className="text-[9px] font-mono text-[#444]">
                              {new Date(turn.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          <div className="markdown-body text-[14px] text-[#999] leading-relaxed">
                            <Markdown>{turn.content}</Markdown>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Loading turn placeholder */}
              {isGenerating && (
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-blue-500/20 backdrop-blur-sm flex items-center gap-3 text-xs text-[#888] font-mono">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="uppercase tracking-widest text-[10px]">
                    Gemini is processing cognitive dialogue...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Multi-Turn Bottom Conversation Input (From Sophisticated Dark design) */}
          <footer className="p-6 sm:p-8 border-t border-[#ffffff0a] bg-[#0a0a0c]/80 backdrop-blur-xl shrink-0">
            <div className="max-w-2xl mx-auto relative">
              <textarea
                id="multi-turn-reply-input"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                rows={3}
                placeholder="Speak into the void... Continue your reflection (Ctrl+Enter to send)"
                className="w-full bg-[#121216] border border-[#ffffff10] rounded-2xl p-5 pr-32 text-[15px] text-[#eee] focus:outline-none focus:border-blue-500/40 transition-all resize-none shadow-inner placeholder:text-[#333]"
              />

              <div className="absolute bottom-5 right-5 flex items-center gap-4">
                <span className="text-[9px] text-[#444] font-mono uppercase tracking-widest hidden sm:inline">
                  Encryption Active
                </span>
                <button
                  id="send-reply-btn"
                  onClick={handleSendReply}
                  disabled={isGenerating || !replyText.trim()}
                  className="bg-white text-black w-10 h-10 rounded-xl flex items-center justify-center hover:bg-blue-400 hover:text-white transition-colors shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isGenerating ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </footer>
        </div>
      )}
    </main>
  );
};
