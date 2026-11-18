import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { jobService } from './services/job.service.js';
import { prisma } from './config/prisma.js';

logger.info(
  {
    pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    maxAttempts: env.JOB_MAX_ATTEMPTS,
    staleLockMs: env.JOB_STALE_LOCK_MS,
  },
  'Ingestion Worker process running. Listening for asynchronous jobs...'
);

let isRunning = true;

async function runWorkerLoop() {
  while (isRunning) {
    try {
      const processed = await jobService.processNextJob();

      if (processed) {
        // If a job was processed, immediately check for the next job without delay
        continue;
      }

      // No jobs available: sleep for poll interval
      await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS));
    } catch (err) {
      logger.error(err, 'Unexpected error in worker loop');
      await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS));
    }
  }
}

async function handleShutdown(signal) {
  logger.info(`Worker received ${signal}. Shutting down worker loop gracefully...`);
  isRunning = false;
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed.');
  } catch (err) {
    logger.error(err, 'Error during worker disconnect');
  }
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

runWorkerLoop().catch(async (err) => {
  logger.error(err, 'Worker process fatal crash');
  try {
    await prisma.$disconnect();
  } catch (_) {}
  process.exit(1);
});
