'use strict';

/**
 * Minimal, bağımlılıksız yapılandırılmış logger.
 * Seviye filtreleme + JSON-benzeri tek satır çıktı. Prod'da makine-okur,
 * dev'de insan-okur kalır. Harici log kütüphanesi eklemeden gözlemlenebilirlik sağlar.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function createLogger(level = 'info') {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const emit = (lvl, msg, ctx) => {
    if (LEVELS[lvl] > threshold) return;
    const line = {
      ts: new Date().toISOString(),
      level: lvl,
      msg,
      ...(ctx && Object.keys(ctx).length ? { ctx } : {}),
    };
    const out = lvl === 'error' || lvl === 'warn' ? console.error : console.log;
    out(JSON.stringify(line));
  };

  return {
    error: (msg, ctx) => emit('error', msg, ctx),
    warn: (msg, ctx) => emit('warn', msg, ctx),
    info: (msg, ctx) => emit('info', msg, ctx),
    debug: (msg, ctx) => emit('debug', msg, ctx),
  };
}

const { config } = require('../config');
const logger = createLogger(config.logLevel);

module.exports = { logger, createLogger };
