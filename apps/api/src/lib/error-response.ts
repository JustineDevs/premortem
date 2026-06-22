type ApiErrorLike = Error & {
  code?: string;
  status?: number;
  field?: string;
  system?: string;
};

function isNotFoundLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const record = error as ApiErrorLike;
  return record.code === 'P2025' || /not found/i.test(record.message);
}

export function apiErrorStatus(
  error: unknown,
  fallbackStatus: number,
  options?: { notFoundStatus?: number }
): number {
  if (error && typeof error === 'object') {
    const candidate = error as { status?: unknown };
    if (typeof candidate.status === 'number') {
      return candidate.status;
    }
  }

  if (options?.notFoundStatus && isNotFoundLikeError(error)) {
    return options.notFoundStatus;
  }

  return fallbackStatus;
}

export function apiErrorResponse(
  error: unknown,
  fallbackMessage: string,
  options?: {
    fallbackStatus?: number;
    notFoundStatus?: number;
    code?: string;
    field?: string;
    system?: string;
  }
) {
  const status = apiErrorStatus(error, options?.fallbackStatus ?? 502, {
    notFoundStatus: options?.notFoundStatus
  });
  const payload: Record<string, unknown> = {
    error: fallbackMessage
  };

  if (options?.code) {
    payload.code = options.code;
  }

  if (options?.field) {
    payload.field = options.field;
  }

  if (options?.system) {
    payload.system = options.system;
  }

  return Response.json(payload, { status });
}
