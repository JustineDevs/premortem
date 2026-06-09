import type { LlmAdapter, LlmGenerateInput, LlmGenerateOutput } from './types';

export class AzureOpenAIAdapter implements LlmAdapter {
  provider = 'azure-openai' as const;

  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly apiVersion = '2025-01-01-preview'
  ) {}

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const url = `${this.endpoint}/openai/deployments/${input.model}/chat/completions?api-version=${this.apiVersion}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'api-key': this.apiKey
      },
      body: JSON.stringify({
        temperature: input.temperature ?? 0.2,
        response_format: { type: 'json_object' },
        messages: input.messages
      })
    });

    if (!response.ok) throw new Error(`Azure OpenAI request failed: ${response.status} ${await response.text()}`);
    const raw = await response.json() as any;
    const text = raw?.choices?.[0]?.message?.content ?? '';
    return { text, raw };
  }
}
