import { createLlmAdapter } from '../../llm/dist/index.js';
import { buildFindingSynthesizerMessages } from '../../llm/dist/prompt-presets.js';
import { parseAndValidateIssueOutput } from '../dist/index.js';

export default class PremortemFindingSynthesizerProvider {
  constructor(options = {}) {
    this.providerId = options.id || 'premortem-finding-synthesizer';
    this.config = options.config || {};
  }

  id() {
    return this.providerId;
  }

  async callApi(_prompt, context) {
    const adapter = createLlmAdapter();
    const model = this.config.model || process.env.LLM_MODEL || 'gemini-3-flash-preview';
    const messages = buildFindingSynthesizerMessages({
      canonicalFindings: context.vars.canonicalFindings,
      dedupeClusters: context.vars.dedupeClusters
    });

    const result = await adapter.generate({
      model,
      messages,
      temperature: this.config.temperature ?? 0.1,
      responseMimeType: 'application/json'
    });

    const summary = parseAndValidateIssueOutput(result.text);

    return {
      output: result.text,
      metadata: summary
    };
  }
}
