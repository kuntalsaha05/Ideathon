export type ReflectionMode = "reflect" | "summarize" | "brainstorm";

export interface ConversationTurn {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export interface JournalInteraction {
  id: string;
  userId: string;
  title: string;
  category: ReflectionMode;
  prompt: string;
  response: string;
  modelUsed: string;
  createdAt: string;
  updatedAt: string;
  turns: ConversationTurn[];
}

export interface AuthUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
