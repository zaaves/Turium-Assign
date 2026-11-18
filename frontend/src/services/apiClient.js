/**
 * Centralized API client wrapper with standardized error handling.
 */
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.error?.message || `Request failed with status ${response.status}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.code = data?.error?.code || 'REQUEST_FAILED';
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status) throw err;
    const networkError = new Error(err.message || 'Network error connecting to backend API');
    networkError.code = 'NETWORK_ERROR';
    networkError.status = 0;
    throw networkError;
  }
}

export async function checkBackendHealth() {
  return apiRequest('/api/health');
}
