import { Router } from 'express';
import { listItems, getItemById } from '../controllers/items.controller.js';

const router = Router();

router.get('/', listItems);
router.get('/:id', getItemById);

export default router;
