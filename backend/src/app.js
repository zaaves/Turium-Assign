import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { errorMiddleware, AppError } from './middleware/error.middleware.js';
import healthRoutes from './routes/health.routes.js';

export const app = express();

app.use(requestIdMiddleware);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    autoLogging: {
      ignore: (req) => req.url === '/api/health' && env.NODE_ENV === 'test',
    },
  })
);

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: env.MAX_INGEST_BYTES }));

// Routes
app.use('/api/health', healthRoutes);

// Catch-all 404
app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
});

// Centralized error handler
app.use(errorMiddleware);
