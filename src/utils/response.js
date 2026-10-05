/**
 * Standard Unified Response Envelopes
 */

export function successResponse(c, { category, provider, data, cached = false, status = 200 }) {
  return c.json(
    {
      ok: true,
      category,
      provider,
      cached,
      timestamp: new Date().toISOString(),
      data
    },
    status
  );
}

export function errorResponse(c, { category, provider, error, message, status = 500 }) {
  return c.json(
    {
      ok: false,
      category,
      provider,
      timestamp: new Date().toISOString(),
      error: typeof error === 'string' ? error : error?.message || 'Unknown error',
      message: message || 'An error occurred while processing the request'
    },
    status
  );
}
