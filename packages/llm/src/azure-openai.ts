import type { LlmAdapter, LlmGenerateInput, LlmGenerateOutput } from './types';
import { tracePremortemLlmGenerate } from '@premortem/observability';

export class AzureOpenAIAdapter implements LlmAdapter {
  provider = 'azure-openai' as const;

  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly apiVersion = '2025-01-01-preview',
    private readonly defaultDeployment?: string
  ) {}

  private resolveRequest(deployment: string) {
    const base = this.endpoint.replace(/\/$/, '');
    if (base.endsWith('/openai/v1')) {
      return {
        url: `${base}/chat/completions`,
        body: (input: LlmGenerateInput) => ({
          model: deployment,
          temperature: input.temperature ?? 0.2,
          response_format: { type: 'json_object' },
          messages: input.messages
        })
      };
    }

    const resourceBase = base.replace(/\/openai\/v1$/, '').replace(/\/$/, '');
    return {
      url: `${resourceBase}/openai/deployments/${deployment}/chat/completions?api-version=${this.apiVersion}`,
      body: (input: LlmGenerateInput) => ({
        temperature: input.temperature ?? 0.2,
        response_format: { type: 'json_object' },
        messages: input.messages
      })
    };
  }

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const deployment =
      input.model && !input.model.startsWith('gemini')
        ? input.model
        : this.defaultDeployment ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? process.env.AZURE_OPENAI_MODEL;
    if (!deployment) {
      throw new Error('Azure OpenAI deployment missing. Set AZURE_OPENAI_DEPLOYMENT or AZURE_OPENAI_MODEL.');
    }

    return tracePremortemLlmGenerate(
      {
        model: deployment,
        provider: 'azure-openai',
        messages: input.messages,
        temperature: input.temperature
      },
      async () => {
        const request = this.resolveRequest(deployment);
        const response = await fetch(request.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'api-key': this.apiKey
          },
          body: JSON.stringify(request.body(input))
        });

        if (!response.ok) {
          throw new Error(`Azure OpenAI request failed: ${response.status} ${await response.text()}`);
        }
        const raw = (await response.json()) as any;
        const text = raw?.choices?.[0]?.message?.content ?? '';
        return { text, raw };
      }
    );
  }
}
