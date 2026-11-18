import { useState } from 'react';
import { ingestNote, ingestUrl } from '../services/items.api';

export function useIngestion({ onIngestSuccess } = {}) {
  const [submitting, setSubmitting] = useState(false);
  const [ingestionError, setIngestionError] = useState(null);
  const [ingestionSuccess, setIngestionSuccess] = useState(null);

  const clearMessages = () => {
    setIngestionError(null);
    setIngestionSuccess(null);
  };

  const submitNote = async ({ title, content }) => {
    clearMessages();
    if (!content || !content.trim()) {
      setIngestionError('Note content is required.');
      return null;
    }

    setSubmitting(true);
    try {
      const createdItem = await ingestNote({ title, content });
      setIngestionSuccess(`Note "${createdItem.title}" queued for processing.`);
      if (onIngestSuccess) {
        onIngestSuccess(createdItem);
      }
      return createdItem;
    } catch (err) {
      setIngestionError(err.message || 'Failed to submit note.');
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const submitUrl = async ({ url }) => {
    clearMessages();
    const trimmed = (url || '').trim();
    if (!trimmed) {
      setIngestionError('A valid web URL is required.');
      return null;
    }

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setIngestionError('Only http:// and https:// URLs are supported.');
      return null;
    }

    setSubmitting(true);
    try {
      const createdItem = await ingestUrl({ url: trimmed });
      setIngestionSuccess(`URL queued for background extraction.`);
      if (onIngestSuccess) {
        onIngestSuccess(createdItem);
      }
      return createdItem;
    } catch (err) {
      setIngestionError(err.message || 'Failed to submit URL.');
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    ingestionError,
    ingestionSuccess,
    clearMessages,
    submitNote,
    submitUrl,
  };
}
