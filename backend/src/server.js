import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const server = app.listen(env.PORT, () => {
  logger.info(`AI Knowledge Inbox API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down API server gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
