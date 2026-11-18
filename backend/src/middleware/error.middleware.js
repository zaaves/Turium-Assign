import { logger } from '../config/logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorMiddleware(err, req, res, _next) {
  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const isAppError = err instanceof AppError;
  const errorCode = err.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  const message = isAppError || statusCode < 500 ? err.message : 'An unexpected server error occurred.';

  logger.error(
    {
      err,
      requestId: req.id,
      url: req.originalUrl,
      method: req.method,
      statusCode,
    },
    'Request failed with error'
  );

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code: errorCode,
      message,
    },
  });
}
