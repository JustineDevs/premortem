/** True when the value is a browser-openable GitLab (or other) issue URL. */
export function isPublishedIssueUrl(value?: string | null): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}
