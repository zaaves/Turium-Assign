import { AppError } from './error.middleware.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error.';
      return next(new AppError(message, 400, 'VALIDATION_ERROR'));
    }
    req.body = result.data;
    next();
  };
}
