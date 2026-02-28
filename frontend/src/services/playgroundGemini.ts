import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../playground/types";

export class PlaygroundGeminiService {
  private ai: GoogleGenAI | null = null;
  private available = false;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
      this.available = true;
    }
  }

  async chat(
    systemInstruction: string,
    history: ChatMessage[],
    message: string,
  ): Promise<string> {
    if (!this.available || !this.ai) {
      return "Hi! To enable AI responses, add GEMINI_API_KEY to your frontend .env file.";
    }

    const model = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";

    const contents = history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
        },
      });

      return response.text || "I'm sorry, I couldn't process that.";
    } catch (error) {
      console.error("Playground Gemini error:", error);
      return "I'm having trouble responding right now. Please try again.";
    }
  }
}

export const playgroundGemini = new PlaygroundGeminiService();
