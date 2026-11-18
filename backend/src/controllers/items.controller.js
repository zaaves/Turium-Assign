import { ingestionService } from '../services/ingestion.service.js';

export async function listItems(_req, res, next) {
  try {
    const items = await ingestionService.getItems();
    res.status(200).json({
      success: true,
      data: { items },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function getItemById(req, res, next) {
  try {
    const item = await ingestionService.getItemById(req.params.id);
    res.status(200).json({
      success: true,
      data: { item },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}
