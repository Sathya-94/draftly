// openAIProvider.js
import { LLMProvider } from "./llmprovider.js";
import OpenAI from "openai";

export class OpenAIProvider extends LLMProvider {
  constructor(apiKey) {
    super("openai");
    this.client = new OpenAI({ apiKey });
  }

  async generate(prompt, { tone, context } = {}) {
    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are an email drafting assistant. Tone: ${tone}` },
        { role: "user", content: prompt }
      ]
    });

    return response.choices[0].message.content;
  }

  async generateStream(prompt, { tone, context } = {}, onToken) {
    const stream = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are an email drafting assistant. Tone: ${tone}` },
        { role: "user", content: prompt }
      ],
      stream: true
    });

    let full = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        if (onToken) onToken(delta);
      }
    }
    return full;
  }
}
