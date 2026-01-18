export class LLMProvider {
  constructor(name) {
    this.name = name;
  }

  async generate(prompt, options = {}) {
    throw new Error("generate() must be implemented by subclass");
  }

  // Optional streaming interface; subclasses can override
  async generateStream(prompt, options = {}, onToken) {
    // Fallback: non-streaming generate
    const full = await this.generate(prompt, options);
    if (onToken) {
      onToken(full);
    }
    return full;
  }
}
