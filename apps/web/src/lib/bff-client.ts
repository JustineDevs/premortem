import { parseBffErrorMessage } from '@/lib/bff-messages';

export class BffRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'BffRequestError';
    this.status = status;
  }
}

export async function readBffErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => ({}));
  return parseBffErrorMessage(payload, fallback);
}

export async function bffFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new BffRequestError(
      await readBffErrorMessage(response, `Request failed (${response.status})`),
      response.status
    );
  }
  return response.json() as Promise<T>;
}

export async function bffFetchOk(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new BffRequestError(
      await readBffErrorMessage(response, `Request failed (${response.status})`),
      response.status
    );
  }
  return response.json().catch(() => ({}));
}

export function isUnauthorizedBffError(error: unknown): boolean {
  return error instanceof BffRequestError && error.status === 401;
}
