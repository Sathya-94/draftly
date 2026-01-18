import { OpenAIProvider } from "../llm/openaiprovider.js";
import { GeminiProvider } from "../llm/geminiprovider.js";

export function getProvider(name, apiKey) {
  switch (name) {
    case "openai":
      return new OpenAIProvider(apiKey);
    case "gemini":
      return new GeminiProvider(apiKey);
    default:
      throw new Error(`Unknown LLM provider: ${name}`);
  }
}
