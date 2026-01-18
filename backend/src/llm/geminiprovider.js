// geminiProvider.js
import { LLMProvider } from "./llmprovider.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiProvider extends LLMProvider {
  constructor(apiKey) {
    super("gemini");
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generate(prompt, { tone, context } = {}) {
    const model = this.client.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent([
      { role: "system", parts: [{ text: `You are an email drafting assistant. Tone: ${tone}` }] },
      { role: "user", parts: [{ text: prompt }] }
    ]);

    return result.response.text();
  }

  async generateStream(prompt, { tone, context } = {}, onToken) {
    // Gemini SDK streaming can be added later; fallback to non-streaming for now
    return this.generate(prompt, { tone, context });
  }
}
