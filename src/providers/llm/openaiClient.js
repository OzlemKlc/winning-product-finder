'use strict';

/**
 * OpenAI Responses API istemcisi — bağımlılıksız `fetch`.
 *
 * Yalnızca transport katmanıdır: talimatları, girdiyi ve function tanımlarını
 * gönderir; ham yanıtı döndürür. İş mantığı insightService içinde kalır.
 */

const { config } = require('../../config');
const { ProviderError } = require('../../utils/errors');

async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function createResponse({ instructions, input, tools, tool_choice, maxTokens = 1024 }) {
  if (!config.openai.apiKey) {
    throw new ProviderError('OPENAI_API_KEY tanımlı değil (AI analiz için gerekli).', {
      hint: 'Sunucuda OPENAI_API_KEY tanımla veya AI analizi kapat.',
    });
  }

  const body = {
    model: config.openai.model,
    input,
    ...(instructions ? { instructions } : {}),
    ...(tools ? { tools } : {}),
    ...(tool_choice ? { tool_choice } : {}),
    max_output_tokens: maxTokens,
  };

  let res;
  try {
    res = await fetchWithTimeout(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.openai.apiKey}`,
        },
        body: JSON.stringify(body),
      },
      config.openai.timeoutMs
    );
  } catch (e) {
    throw new ProviderError(
      e.name === 'AbortError' ? 'OpenAI isteği zaman aşımına uğradı.' : `OpenAI bağlantı hatası: ${e.message}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ProviderError(`OpenAI hata ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

module.exports = { createResponse };
