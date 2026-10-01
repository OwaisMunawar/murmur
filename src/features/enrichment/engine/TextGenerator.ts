export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatTurn = { role: ChatRole; content: string };

export type GenerateOptions = {
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
  /**
   * Text the reply is forced to start with, written into the assistant turn
   * before generation. Prefilling `{"title": "` all but guarantees a small
   * model answers in JSON. The returned text includes the prefix.
   */
  prefix?: string;
};

export type Generation = {
  text: string;
  promptTokens: number;
  generatedTokens: number;
  durationMs: number;
};

/**
 * Stateless text generation: every call starts from an empty context. Notes
 * are enriched and questions answered independently, so carrying a KV cache
 * between calls would only leak one note's content into the next prompt.
 */
export interface TextGenerator {
  readonly modelId: string;
  generate(messages: readonly ChatTurn[], options: GenerateOptions): Promise<Generation>;
  dispose(): void;
}

export function tokensPerSecond(generation: Generation): number {
  return generation.durationMs > 0
    ? (generation.generatedTokens / generation.durationMs) * 1000
    : 0;
}
