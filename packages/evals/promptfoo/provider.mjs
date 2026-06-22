import { createLlmAdapter } from '../../llm/dist/index.js';
import { issueEnvelopeSchema, validateIssueCandidate } from '../../agent-kit/dist/index.js';
import { parseAndValidateIssueOutput } from '../dist/index.js';
import { SMOKE_GEMINI_MODEL } from '../../domain/dist/index.js';
import {
  buildFixtureOutputFromFindings,
  buildFixtureOutputFromIssueCandidates,
  buildPromptMessages
} from './shared-fixtures.mjs';

function normalizePromptText(prompt) {
  return typeof prompt === 'string' ? prompt : '';
}

function buildPromptProbeOutput(prompt, context) {
  const promptText = normalizePromptText(prompt);
  const promptPath = typeof context?.vars?.promptPath === 'string' ? context.vars.promptPath : '';
  return {
    promptPath,
    promptText,
    hasFloor: promptText.includes('Premortem Specialist Production Floor'),
    hasConfidenceFloor: promptText.includes('0.85'),
    hasEmptyEnvelopeRefusal:
      /empty envelope/i.test(promptText) && /confidence floor/i.test(promptText),
    hasWorkflowContract: promptText.includes('Premortem Workflow Contract'),
    lineCount: promptText.split('\n').length
  };
}

function selectFixtureOutput(prompt, context) {
  const promptText = normalizePromptText(prompt);
  const vars = context?.vars ?? {};
  if (/Issue Validator Agent/i.test(promptText) || /issue-validator/i.test(String(vars.promptPath ?? ''))) {
    const validCandidates = Array.isArray(vars.issueCandidates)
      ? vars.issueCandidates.filter((candidate) => validateIssueCandidate(candidate).length === 0)
      : [];
    return buildFixtureOutputFromIssueCandidates(validCandidates);
  }

  return buildFixtureOutputFromFindings(vars.canonicalFindings ?? []);
}

export default class PremortemFindingSynthesizerProvider {
  constructor(options = {}) {
    this.providerId = options.id || 'premortem-finding-synthesizer';
    this.config = options.config || {};
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt, context) {
    const model = this.config.model || process.env.LLM_MODEL || SMOKE_GEMINI_MODEL;
    const promptText = normalizePromptText(prompt);
    if (this.config.mode === 'prompt-probe' || this.providerId === 'premortem-prompt-probe') {
      const output = JSON.stringify(buildPromptProbeOutput(promptText, context));
      return {
        output,
        metadata: { promptProbe: true, promptPath: context?.vars?.promptPath ?? '' }
      };
    }
    const { messages } = buildPromptMessages(promptText, context);

    if (!process.env.GEMINI_API_KEY) {
      const output = JSON.stringify(selectFixtureOutput(promptText, context));
      return {
        output,
        metadata: parseAndValidateIssueOutput(output)
      };
    }

    const adapter = createLlmAdapter();
    const result = await adapter.generateObject({
      model,
      messages,
      temperature: this.config.temperature ?? 0.1,
      schema: issueEnvelopeSchema
    });

    const output = JSON.stringify(result.output);
    return {
      output,
      metadata: parseAndValidateIssueOutput(output)
    };
  }
}
