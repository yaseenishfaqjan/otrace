/**
 * One place that talks to the API.
 *
 * `response.json()` throws "Unexpected end of JSON input" on an empty body —
 * which is exactly what you get from a 404, a 502, or a static preview with no
 * backend behind it. Showing a customer a JSON parser error at the moment they
 * are trying to pay is the worst possible failure, so every response is parsed
 * defensively and turned into something a person can act on.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const humanFor = (status: number) => {
  if (status === 0) return 'We could not reach the store. Check your connection and try again.';
  if (status === 404) return 'Checkout is not available on this preview yet.';
  if (status === 429) return 'Too many attempts just now. Give it a moment and try again.';
  if (status >= 500) return 'The store is having a moment. Please try again shortly.';
  return 'Something went wrong. Please try again.';
};

export async function postJson<T = Record<string, unknown>>(
  path: string,
  body: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Network-level failure: offline, DNS, CORS, connection refused.
    throw new ApiError(humanFor(0), 0);
  }

  // Read as text first. An empty body and an HTML error page both parse as
  // nothing useful, and both would otherwise surface as a parser error.
  const raw = await response.text();
  let data: Record<string, unknown> | null = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const fromServer = typeof data?.error === 'string' ? data.error : null;
    throw new ApiError(fromServer ?? humanFor(response.status), response.status);
  }

  if (!data) {
    throw new ApiError('The store sent back an unexpected reply. Please try again.', response.status);
  }

  return data as T;
}
