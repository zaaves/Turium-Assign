import { Router } from 'express';
import { handleIngest } from '../controllers/ingest.controller.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { ingestRequestSchema } from '../schemas/ingest.schema.js';

const router = Router();

router.post('/', validateBody(ingestRequestSchema), handleIngest);

export default router;
