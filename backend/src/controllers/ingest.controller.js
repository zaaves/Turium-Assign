import { ingestionService } from '../services/ingestion.service.js';

export async function handleIngest(req, res, next) {
  try {
    const { sourceType } = req.body;
    let item;

    if (sourceType === 'NOTE') {
      item = await ingestionService.ingestNote(req.body);
    } else {
      item = await ingestionService.ingestUrl(req.body);
    }

    res.status(202).json({
      success: true,
      data: {
        item: {
          id: item.id,
          title: item.title,
          sourceType: item.sourceType,
          status: item.status,
          createdAt: item.createdAt,
        },
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}
