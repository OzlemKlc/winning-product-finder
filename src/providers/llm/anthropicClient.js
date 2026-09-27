'use strict';

/**
 * Anthropic (Claude) Messages API istemcisi — bağımlılıksız `fetch`.
 *
 * Sadece transport: mesaj + tool tanımlarını gönderir, ham yanıtı döndürür.
 * İş mantığı (hangi tool, şema, parse) insightService'tedir. Böylece istemci
 * test edilebilir ve enjekte edilebilir (dependency injection) kalır.
 *
 * Referans: POST https://api.anthropic.com/v1/messages
 *   headers: x-api-key, anthropic-version, content-type
 */

const { config } = require('../../config');
const { ProviderError } = require('../../utils/errors');

async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Messages API çağrısı yapar.
 * @param {object} p
 * @param {string} [p.system]
 * @param {Array}  p.messages
 * @param {Array}  [p.tools]
 * @param {object} [p.tool_choice]
 * @param {number} [p.maxTokens]
 * @returns {Promise<object>} ham API yanıtı (content blokları dahil)
 */
async function createMessage({ system, messages, tools, tool_choice, maxTokens = 1024 }) {
  if (!config.anthropic.apiKey) {
    throw new ProviderError('ANTHROPIC_API_KEY tanımlı değil (AI analiz için gerekli).', {
      hint: 'Sunucuda ANTHROPIC_API_KEY tanımla veya AI analizi kapat.',
    });
  }

  const body = {
    model: config.anthropic.model,
    max_tokens: maxTokens,
    messages,
    ...(system ? { system } : {}),
    ...(tools ? { tools } : {}),
    ...(tool_choice ? { tool_choice } : {}),
  };

  let res;
  try {
    res = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.anthropic.apiKey,
          'anthropic-version': config.anthropic.version,
        },
        body: JSON.stringify(body),
      },
      config.anthropic.timeoutMs
    );
  } catch (e) {
    throw new ProviderError(
      e.name === 'AbortError' ? 'Anthropic isteği zaman aşımına uğradı.' : `Anthropic bağlantı hatası: ${e.message}`
    );
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new ProviderError(`Anthropic hata ${res.status}: ${txt.slice(0, 300)}`);
  }

  return res.json();
}

module.exports = { createMessage };
