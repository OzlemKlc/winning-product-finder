'use strict';

/**
 * Uygulama giriş noktası.
 * Çalıştır:  node src/index.js   (veya: npm start)
 */

const { start } = require('./server/httpServer');
const { logger } = require('./utils/logger');
const { resetRepository } = require('./repositories');

const server = start();

// Zarif kapanış — açık DB bağlantılarını serbest bırak
async function shutdown(signal) {
  logger.info('server.shutdown', { signal });
  server.close();
  await resetRepository();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
