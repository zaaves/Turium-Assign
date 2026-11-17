import { env } from './config/env.js';
import { logger } from './config/logger.js';

logger.info(
  {
    pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    maxAttempts: env.JOB_MAX_ATTEMPTS,
  },
  'Ingestion Worker process initialized (Milestone 1 stub). Ready for Milestone 2 worker loop.'
);

let isRunning = true;

async function runWorkerLoop() {
  while (isRunning) {
    // Milestone 1 heartbeat/idle loop
    await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS));
  }
}

function handleShutdown(signal) {
  logger.info(`Worker received ${signal}. Stopping loop...`);
  isRunning = false;
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

runWorkerLoop().catch((err) => {
  logger.error(err, 'Worker process fatal error');
  process.exit(1);
});
