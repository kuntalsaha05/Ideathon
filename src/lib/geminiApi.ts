import { ReflectionMode, ConversationTurn } from "../types";

export interface ReflectRequest {
  prompt: string;
  mode: ReflectionMode;
  history?: Array<{ role: "user" | "assistant" | "model"; content: string }>;
}

export interface ReflectResponse {
  success: boolean;
  text: string;
  modelUsed: string;
  mode: ReflectionMode;
}

export async function requestGeminiReflection(
  prompt: string,
  mode: ReflectionMode,
  pastTurns?: ConversationTurn[]
): Promise<ReflectResponse> {
  const history = pastTurns
    ? pastTurns.map((turn) => ({
        role: turn.role === "model" ? ("assistant" as const) : ("user" as const),
        content: turn.content,
      }))
    : [];

  const response = await fetch("/api/gemini/reflect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      mode,
      history,
    }),
  });

  if (!response.ok) {
    let errorDetail = "Failed to communicate with reflection assistant.";
    try {
      const errorJson = await response.json();
      if (errorJson?.error) {
        errorDetail = errorJson.error;
      }
    } catch {
      errorDetail = `Server responded with status ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  const data: ReflectResponse = await response.json();
  return data;
}
