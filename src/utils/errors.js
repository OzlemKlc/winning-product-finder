'use strict';

/**
 * Uygulama genelinde tutarlı, tipli hata sınıfları.
 * HTTP katmanı bu hataları status koda çevirir; iç katmanlar sadece uygun
 * hatayı fırlatır ve transport (HTTP/serverless) detayından habersiz kalır.
 */

class AppError extends Error {
  /**
   * @param {string} message  Kullanıcıya gösterilebilir mesaj
   * @param {number} status   HTTP status kodu
   * @param {object} [meta]   Ek bağlam (log/hint)
   */
  constructor(message, status = 500, meta = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.meta = meta;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return { error: this.message, ...(this.meta.hint ? { hint: this.meta.hint } : {}) };
  }
}

/** 400 — İstek doğrulaması başarısız. */
class ValidationError extends AppError {
  constructor(message, meta = {}) {
    super(message, 400, meta);
  }
}

/** 502 — Harici sağlayıcı (ör. Apify) hatası. */
class ProviderError extends AppError {
  constructor(message, meta = {}) {
    super(message, 502, { hint: 'Canlı mod başarısızsa Demo moduna geçebilirsin.', ...meta });
  }
}

/** 503 — Kalıcılık/altyapı geçici olarak kullanılamıyor. */
class RepositoryError extends AppError {
  constructor(message, meta = {}) {
    super(message, 503, meta);
  }
}

module.exports = { AppError, ValidationError, ProviderError, RepositoryError };
