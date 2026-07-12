import assert from 'node:assert/strict';
import test from 'node:test';

import { createLlmAdapter } from './factory';
import { normalizeCompatibleBaseUrl } from './client';
import { resolveLlmProviderTargets } from './routing';
import {
  createQwenPayAsYouGoClient,
  resolveQwenCompatibleBaseUrl,
  resolveQwenKeyMode
} from './qwen';

test('normalizeCompatibleBaseUrl appends /v1 for OpenAI-compatible local providers', () => {
  assert.equal(normalizeCompatibleBaseUrl('http://127.0.0.1:1234'), 'http://127.0.0.1:1234/v1');
  assert.equal(normalizeCompatibleBaseUrl('http://127.0.0.1:1234/'), 'http://127.0.0.1:1234/v1');
});

test('normalizeCompatibleBaseUrl preserves existing /v1 endpoints', () => {
  assert.equal(normalizeCompatibleBaseUrl('http://127.0.0.1:1234/v1'), 'http://127.0.0.1:1234/v1');
  assert.equal(normalizeCompatibleBaseUrl('http://127.0.0.1:1234/v1/'), 'http://127.0.0.1:1234/v1');
});

test('resolveQwenCompatibleBaseUrl uses token-plan for sk-sp keys', () => {
  const savedEnv = {
    QWEN_API_KEY: process.env.QWEN_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
    QWEN_BASE_URL: process.env.QWEN_BASE_URL,
    DASHSCOPE_BASE_URL: process.env.DASHSCOPE_BASE_URL
  };

  process.env.QWEN_API_KEY = 'sk-sp-test-token-plan-key';
  process.env.DASHSCOPE_API_KEY = '';
  delete process.env.QWEN_BASE_URL;
  delete process.env.DASHSCOPE_BASE_URL;

  try {
    assert.equal(
      resolveQwenCompatibleBaseUrl(),
      'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'
    );
  } finally {
    const restore = (key: string, value: string | undefined) => {
      if (typeof value === 'string') {
        process.env[key] = value;
        return;
      }
      delete process.env[key];
    };

    restore('QWEN_API_KEY', savedEnv.QWEN_API_KEY);
    restore('DASHSCOPE_API_KEY', savedEnv.DASHSCOPE_API_KEY);
    restore('QWEN_BASE_URL', savedEnv.QWEN_BASE_URL);
    restore('DASHSCOPE_BASE_URL', savedEnv.DASHSCOPE_BASE_URL);
  }
});

test('resolveQwenCompatibleBaseUrl uses the pay-as-you-go endpoint for sk-ws keys', () => {
  const savedEnv = {
    QWEN_API_KEY: process.env.QWEN_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
    QWEN_BASE_URL: process.env.QWEN_BASE_URL,
    DASHSCOPE_BASE_URL: process.env.DASHSCOPE_BASE_URL
  };

  process.env.QWEN_API_KEY = 'sk-ws-test-paygo-key';
  process.env.DASHSCOPE_API_KEY = '';
  delete process.env.QWEN_BASE_URL;
  delete process.env.DASHSCOPE_BASE_URL;

  try {
    assert.equal(resolveQwenKeyMode('sk-ws-test-paygo-key'), 'pay-as-you-go');
    assert.equal(
      resolveQwenCompatibleBaseUrl(),
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    );
  } finally {
    const restore = (key: string, value: string | undefined) => {
      if (typeof value === 'string') {
        process.env[key] = value;
        return;
      }
      delete process.env[key];
    };

    restore('QWEN_API_KEY', savedEnv.QWEN_API_KEY);
    restore('DASHSCOPE_API_KEY', savedEnv.DASHSCOPE_API_KEY);
    restore('QWEN_BASE_URL', savedEnv.QWEN_BASE_URL);
    restore('DASHSCOPE_BASE_URL', savedEnv.DASHSCOPE_BASE_URL);
  }
});

test('createQwenPayAsYouGoClient rejects token-plan keys', () => {
  const savedEnv = {
    QWEN_API_KEY: process.env.QWEN_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY
  };

  process.env.QWEN_API_KEY = 'sk-sp-test-token-plan-key';
  process.env.DASHSCOPE_API_KEY = '';

  try {
    assert.throws(() => createQwenPayAsYouGoClient(), /pay-as-you-go Qwen key/i);
  } finally {
    const restore = (key: string, value: string | undefined) => {
      if (typeof value === 'string') {
        process.env[key] = value;
        return;
      }
      delete process.env[key];
    };

    restore('QWEN_API_KEY', savedEnv.QWEN_API_KEY);
    restore('DASHSCOPE_API_KEY', savedEnv.DASHSCOPE_API_KEY);
  }
});

test('resolveQwenCompatibleBaseUrl rejects token-plan base URLs for non-token-plan keys', () => {
  const savedEnv = {
    QWEN_API_KEY: process.env.QWEN_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
    QWEN_BASE_URL: process.env.QWEN_BASE_URL,
    DASHSCOPE_BASE_URL: process.env.DASHSCOPE_BASE_URL
  };

  process.env.QWEN_API_KEY = 'sk-test-paygo-key';
  process.env.DASHSCOPE_API_KEY = '';
  process.env.QWEN_BASE_URL =
    'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';
  delete process.env.DASHSCOPE_BASE_URL;

  try {
    assert.throws(
      () => resolveQwenCompatibleBaseUrl(),
      /Token Plan endpoint/i
    );
  } finally {
    const restore = (key: string, value: string | undefined) => {
      if (typeof value === 'string') {
        process.env[key] = value;
        return;
      }
      delete process.env[key];
    };

    restore('QWEN_API_KEY', savedEnv.QWEN_API_KEY);
    restore('DASHSCOPE_API_KEY', savedEnv.DASHSCOPE_API_KEY);
    restore('QWEN_BASE_URL', savedEnv.QWEN_BASE_URL);
    restore('DASHSCOPE_BASE_URL', savedEnv.DASHSCOPE_BASE_URL);
  }
});

test('dead local providers are suppressed after the first failure in the same process', async () => {
  const restoreEnvVar = (key: string, value: string | undefined) => {
    if (typeof value === 'string') {
      process.env[key] = value;
      return;
    }
    delete process.env[key];
  };

  const savedEnv = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    QWEN_API_KEY: process.env.QWEN_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    LLM_PROVIDER: process.env.LLM_PROVIDER
  };

  process.env.GEMINI_API_KEY = '';
  process.env.OPENAI_API_KEY = '';
  process.env.QWEN_API_KEY = '';
  process.env.DASHSCOPE_API_KEY = '';
  process.env.ANTHROPIC_API_KEY = '';
  process.env.LLM_PROVIDER = '';

  try {
    const adapter = createLlmAdapter({
      customProviders: [
        {
          name: 'dead-local',
          host: 'http://127.0.0.1:59999',
          model: 'test-model',
          active: true
        }
      ]
    });

    const firstError = await adapter
      .generate({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Return one short sentence.' },
          { role: 'user', content: 'hello' }
        ],
        maxOutputTokens: 32
      })
      .then(
        () => null,
        (error: unknown) => (error instanceof Error ? error.message : String(error))
      );

    const secondError = await adapter
      .generate({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Return one short sentence.' },
          { role: 'user', content: 'hello again' }
        ],
        maxOutputTokens: 32
      })
      .then(
        () => null,
        (error: unknown) => (error instanceof Error ? error.message : String(error))
      );

    assert.ok(firstError);
    assert.match(firstError, /127\.0\.0\.1:59999/);
    assert.ok(secondError);
    assert.doesNotMatch(secondError, /127\.0\.0\.1:59999/);
  } finally {
    restoreEnvVar('GEMINI_API_KEY', savedEnv.GEMINI_API_KEY);
    restoreEnvVar('OPENAI_API_KEY', savedEnv.OPENAI_API_KEY);
    restoreEnvVar('QWEN_API_KEY', savedEnv.QWEN_API_KEY);
    restoreEnvVar('DASHSCOPE_API_KEY', savedEnv.DASHSCOPE_API_KEY);
    restoreEnvVar('ANTHROPIC_API_KEY', savedEnv.ANTHROPIC_API_KEY);
    restoreEnvVar('LLM_PROVIDER', savedEnv.LLM_PROVIDER);
  }
});

test('OpenRouter is preferred as the default provider when configured', () => {
  const savedEnv = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPEN_ROUTER_API_KEY: process.env.OPEN_ROUTER_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    QWEN_API_KEY: process.env.QWEN_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
    LLM_PROVIDER: process.env.LLM_PROVIDER
  };

  process.env.OPENROUTER_API_KEY = 'sk-or-test';
  process.env.OPEN_ROUTER_API_KEY = '';
  process.env.OPENAI_API_KEY = 'sk-openai-test';
  process.env.GEMINI_API_KEY = '';
  process.env.ANTHROPIC_API_KEY = '';
  process.env.QWEN_API_KEY = '';
  process.env.DASHSCOPE_API_KEY = '';
  process.env.LLM_PROVIDER = '';

  try {
    const adapter = createLlmAdapter();
    assert.equal(adapter.provider, 'openrouter');
  } finally {
    const restoreEnvVar = (key: string, value: string | undefined) => {
      if (typeof value === 'string') {
        process.env[key] = value;
        return;
      }
      delete process.env[key];
    };

    restoreEnvVar('OPENROUTER_API_KEY', savedEnv.OPENROUTER_API_KEY);
    restoreEnvVar('OPEN_ROUTER_API_KEY', savedEnv.OPEN_ROUTER_API_KEY);
    restoreEnvVar('OPENAI_API_KEY', savedEnv.OPENAI_API_KEY);
    restoreEnvVar('GEMINI_API_KEY', savedEnv.GEMINI_API_KEY);
    restoreEnvVar('ANTHROPIC_API_KEY', savedEnv.ANTHROPIC_API_KEY);
    restoreEnvVar('QWEN_API_KEY', savedEnv.QWEN_API_KEY);
    restoreEnvVar('DASHSCOPE_API_KEY', savedEnv.DASHSCOPE_API_KEY);
    restoreEnvVar('LLM_PROVIDER', savedEnv.LLM_PROVIDER);
  }
});

test('OpenRouter remaps managed model families into OpenRouter slugs', () => {
  const targets = resolveLlmProviderTargets({
    model: 'gemini-2.5-flash',
    defaultProvider: 'openrouter',
    customProviders: []
  });

  assert.equal(targets[0]?.provider, 'openrouter');
  assert.equal(targets[0]?.model, 'google/gemini-2.5-flash');
});
