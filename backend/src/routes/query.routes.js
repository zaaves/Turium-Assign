import { Router } from 'express';
import { handleQuery } from '../controllers/query.controller.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { queryRequestSchema } from '../schemas/query.schema.js';

const router = Router();

router.post('/', validateBody(queryRequestSchema), handleQuery);

export default router;
