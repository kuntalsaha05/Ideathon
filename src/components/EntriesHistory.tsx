import React, { useState } from "react";
import { JournalInteraction, ReflectionMode } from "../types";
import {
  Search,
  Sparkles,
  Lightbulb,
  FileText,
  Trash2,
  Calendar,
  MessageSquare,
  Plus,
} from "lucide-react";

interface EntriesHistoryProps {
  entries: JournalInteraction[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalInteraction) => void;
  onNewEntry: () => void;
  onDeleteEntry: (entryId: string) => Promise<void>;
  loading: boolean;
}

export const EntriesHistory: React.FC<EntriesHistoryProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  loading,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<ReflectionMode | "all">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredEntries = entries.filter((entry) => {
    const matchesFilter = filterMode === "all" || entry.category === filterMode;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesFilter;

    const matchesSearch =
      entry.title.toLowerCase().includes(query) ||
      entry.prompt.toLowerCase().includes(query) ||
      entry.response.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const getCategoryBadge = (category: ReflectionMode) => {
    switch (category) {
      case "summarize":
        return {
          label: "Summary",
          icon: FileText,
          classes: "text-blue-400 border-blue-500/20 bg-blue-500/5",
        };
      case "brainstorm":
        return {
          label: "Brainstorm",
          icon: Lightbulb,
          classes: "text-amber-400 border-amber-500/20 bg-amber-500/5",
        };
      case "reflect":
      default:
        return {
          label: "Reflection",
          icon: Sparkles,
          classes: "text-indigo-300 border-indigo-500/20 bg-indigo-500/5",
        };
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Recent";
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this reflection entry?")) {
      try {
        setDeletingId(id);
        await onDeleteEntry(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <aside className="w-full md:w-80 lg:w-88 bg-[#0f0f12] border-r border-[#ffffff0a] flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Search & Filter in Sophisticated Dark */}
      <div className="p-5 border-b border-[#ffffff0a] space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold text-[#555] uppercase tracking-wider">
              Past Reflections
            </p>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-[#777]">
              {entries.length}
            </span>
          </div>

          <button
            id="history-new-entry-btn"
            onClick={onNewEntry}
            className="text-[11px] font-mono uppercase tracking-widest text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>New</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#555] absolute left-3.5 top-3" />
          <input
            id="search-entries-input"
            type="text"
            placeholder="Search cognitive archive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#121216] border border-[#ffffff10] text-xs text-[#eee] placeholder:text-[#444] focus:outline-none focus:border-blue-500/40 transition-all font-sans"
          />
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
          {(
            [
              { id: "all", label: "All" },
              { id: "reflect", label: "Reflect" },
              { id: "summarize", label: "Summary" },
              { id: "brainstorm", label: "Ideas" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterMode(filter.id)}
              className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all shrink-0 cursor-pointer border ${
                filterMode === filter.id
                  ? "bg-white/[0.08] text-white border-white/20"
                  : "bg-transparent text-[#666] border-transparent hover:bg-white/[0.03] hover:text-[#999]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {loading && entries.length === 0 ? (
          <div className="py-12 text-center text-[#555] space-y-3 font-mono text-xs">
            <div className="w-5 h-5 border-2 border-[#333] border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="tracking-wider uppercase text-[10px]">Retrieving from Firestore...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-16 px-4 text-center text-[#555] space-y-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto text-[#444]">
              <FileText className="w-4 h-4" />
            </div>
            {searchQuery || filterMode !== "all" ? (
              <p className="text-xs text-[#666]">No entries match your filter.</p>
            ) : (
              <div>
                <p className="text-xs font-medium text-[#888]">Archive is empty</p>
                <p className="text-[10px] text-[#444] mt-1 font-mono uppercase tracking-wider">
                  Create your first reflection
                </p>
              </div>
            )}
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const badge = getCategoryBadge(entry.category);
            const BadgeIcon = badge.icon;
            const isSelected = activeEntryId === entry.id;

            return (
              <div
                key={entry.id}
                id={`entry-card-${entry.id}`}
                onClick={() => onSelectEntry(entry)}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all relative group ${
                  isSelected
                    ? "bg-[#ffffff05] border-blue-500/30 text-white shadow-lg shadow-black/40"
                    : "bg-transparent hover:bg-[#ffffff03] border-transparent text-[#888]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${
                      isSelected
                        ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                        : badge.classes
                    }`}
                  >
                    <BadgeIcon className="w-2.5 h-2.5" />
                    <span>{badge.label}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-tighter flex items-center gap-1 ${
                        isSelected ? "text-[#777]" : "text-[#555]"
                      }`}
                    >
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDate(entry.createdAt)}
                    </span>

                    {/* Delete action button */}
                    <button
                      title="Delete entry"
                      disabled={deletingId === entry.id}
                      onClick={(e) => handleDelete(e, entry.id)}
                      className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 hover:text-red-400 ${
                        isSelected ? "text-[#555]" : "text-[#444]"
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <h3
                  className={`text-sm font-medium line-clamp-1 mb-1 ${
                    isSelected ? "text-white" : "text-[#aaa] group-hover:text-white"
                  }`}
                >
                  {entry.title || "Untitled Reflection"}
                </h3>

                <p
                  className={`text-xs line-clamp-2 leading-relaxed ${
                    isSelected ? "text-[#999]" : "text-[#555]"
                  }`}
                >
                  {entry.prompt}
                </p>

                {entry.turns && entry.turns.length > 0 && (
                  <div
                    className={`mt-2.5 pt-2 border-t text-[10px] font-mono flex items-center gap-1 ${
                      isSelected
                        ? "border-white/5 text-blue-400/80"
                        : "border-white/[0.03] text-[#444]"
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>{entry.turns.length + 1} TURNS IN DIALOGUE</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
