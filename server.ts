import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// 1. Top-Level Request Deserialization (Ordering Guarantee)
// Mounted BEFORE any route handlers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cross-Origin Resource Sharing (CORS) for external frontend hosting (e.g. GitHub Pages)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Lazy initialization of Gemini SDK
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured in the environment. Please set GEMINI_API_KEY in your AI Studio secrets or environment variables."
    );
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

// Fallback Model Ladder as required by Production Directives
const MODEL_FALLBACK_LADDER = [
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
];

// Helper to determine recoverable status codes
function isRecoverableError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  if (status === 503 || status === 429 || status === 404 || status === 500) {
    return true;
  }
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("unavailable") ||
    msg.includes("resource_exhausted") ||
    msg.includes("overloaded") ||
    msg.includes("not_found") ||
    msg.includes("internal")
  );
}

// Standard Resilient Gemini Helper
async function generateContentWithFallback(
  systemInstruction: string,
  contents: any[]
): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();
  let lastError: any = null;

  for (const modelName of MODEL_FALLBACK_LADDER) {
    try {
      console.log(`[Gemini API] Attempting generation with model: ${modelName}`);
      const response = await ai.models.generateContent({
        model: modelName,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
        contents,
      });

      const text = response.text || "";
      if (text) {
        console.log(`[Gemini API] Success with model: ${modelName}`);
        return { text, modelUsed: modelName };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[Gemini API] Failed with model ${modelName}:`,
        err?.message || err
      );
      if (!isRecoverableError(err)) {
        // If not recoverable or authorization error, rethrow immediately
        if (err?.status === 401 || err?.status === 403) {
          throw err;
        }
      }
      // Otherwise proceed to next model in ladder
    }
  }

  throw lastError || new Error("All Gemini models in fallback ladder failed.");
}

// Health check route
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Gemini Reflect / Summarize / Brainstorm multi-turn endpoint
app.post("/api/gemini/reflect", async (req: Request, res: Response) => {
  try {
    // Defensive Payload Ingestion (Null-Safe Destructuring)
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const mode = typeof body.mode === "string" ? body.mode.trim() : "reflect";
    const history = Array.isArray(body.history) ? body.history : [];

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt cannot be empty. Please provide a reflection or entry.",
      });
    }

    if (prompt.length > 15000) {
      return res.status(400).json({
        error: "Prompt exceeds maximum allowed length of 15,000 characters.",
      });
    }

    // Role system prompt tailored to user mode
    let systemInstruction = `You are a thoughtful, empathetic, and insightful reflection partner and journal companion.
Your purpose is to help the user process their thoughts, celebrate progress, understand challenges, and uncover deeper perspectives.
Formatting: Use clean, elegant Markdown with readable paragraph breaks, bullet points where helpful, and meaningful section highlights. Avoid clichés, overly dramatic tone, or generic corporate filler words.`;

    if (mode === "summarize") {
      systemInstruction += `\nMode: "Summary & Synthesis". Synthesize the core emotions, themes, decisions, and takeaways from the user's reflection in a crisp, structured format. Highlight Key Insights and Core Sentiment.`;
    } else if (mode === "brainstorm") {
      systemInstruction += `\nMode: "Creative Brainstorming & Action Steps". Help the user explore next steps, creative alternatives, perspective shifts, or constructive experiments based on their reflection. Provide actionable, inspiring, concrete ideas.`;
    } else {
      systemInstruction += `\nMode: "Reflective Inquire & Dialogue". Offer gentle perspective, validate real emotions, highlight subtle patterns or strengths, and ask 1-2 thoughtful open-ended questions to deepen their self-awareness.`;
    }

    // Build multi-turn contents array
    const contents: any[] = [];

    // Sanitize past conversation history
    for (const item of history) {
      if (item && typeof item === "object" && typeof item.content === "string") {
        const role = item.role === "assistant" || item.role === "model" ? "model" : "user";
        contents.push({
          role,
          parts: [{ text: item.content.slice(0, 10000) }],
        });
      }
    }

    // Append current user prompt
    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const result = await generateContentWithFallback(systemInstruction, contents);

    return res.json({
      success: true,
      text: result.text,
      modelUsed: result.modelUsed,
      mode,
    });
  } catch (error: any) {
    console.error("[Server /api/gemini/reflect Error]:", error);
    const statusCode = error?.status || 500;
    return res.status(statusCode).json({
      error: error?.message || "Internal server error while communicating with Gemini.",
    });
  }
});

// Vite Middleware for development / Static files in production
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
