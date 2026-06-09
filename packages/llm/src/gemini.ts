import type { LlmAdapter, LlmGenerateInput, LlmGenerateOutput } from './types';

export class GeminiAdapter implements LlmAdapter {
  provider = 'gemini' as const;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta'
  ) {}

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const response = await fetch(`${this.baseUrl}/models/${input.model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        generationConfig: {
          temperature: input.temperature ?? 0.2,
          responseMimeType: input.responseMimeType ?? 'application/json'
        },
        contents: input.messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: `[${message.role}] ${message.content}` }]
        }))
      })
    });

    if (!response.ok) throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
    const raw = await response.json() as any;
    const text = raw?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('\n') ?? '';
    return { text, raw };
  }
}
