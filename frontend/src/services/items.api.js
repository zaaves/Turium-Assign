import { apiRequest } from './apiClient';

/**
 * Retrieves list of saved items with ingestion status and chunk counts.
 */
export async function getItems() {
  const res = await apiRequest('/api/items');
  return res.data?.items || [];
}

/**
 * Retrieves detailed item record including full raw/extracted content.
 */
export async function getItemById(id) {
  const res = await apiRequest(`/api/items/${id}`);
  return res.data?.item;
}

/**
 * Submits a plain-text note for asynchronous ingestion.
 */
export async function ingestNote({ title, content }) {
  const payload = {
    sourceType: 'NOTE',
    content,
  };
  if (title && title.trim()) {
    payload.title = title.trim();
  }

  const res = await apiRequest('/api/ingest', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return res.data?.item;
}

/**
 * Submits a web URL for asynchronous server-side extraction and ingestion.
 */
export async function ingestUrl({ url }) {
  const res = await apiRequest('/api/ingest', {
    method: 'POST',
    body: JSON.stringify({
      sourceType: 'URL',
      url: url.trim(),
    }),
  });

  return res.data?.item;
}
