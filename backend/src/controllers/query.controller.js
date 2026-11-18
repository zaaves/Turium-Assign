import { ragService } from '../services/rag.service.js';

export async function handleQuery(req, res, next) {
  try {
    const { question, topK } = req.body;
    const result = await ragService.answerQuestion({ question, topK });

    res.status(200).json({
      success: true,
      data: result,
      error: null,
    });
  } catch (err) {
    next(err);
  }
}
