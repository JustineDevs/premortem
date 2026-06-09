export function getApiBaseUrl() {
  return process.env.PREMORTEM_API_BASE_URL ?? 'http://127.0.0.1:18787';
}
