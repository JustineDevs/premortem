export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmGenerateInput {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  responseMimeType?: string;
}

export interface LlmGenerateOutput {
  text: string;
  raw: unknown;
}

export interface LlmAdapter {
  provider: 'gemini' | 'azure-openai';
  generate(input: LlmGenerateInput): Promise<LlmGenerateOutput>;
}
