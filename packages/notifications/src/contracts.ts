export interface NotificationMessage {
  userId: string;
  kind:
    | 'audit_completed'
    | 'audit_failed'
    | 'issues_ready'
    | 'issue_published'
    | 'critical_finding'
    | 'provider_reauth_required';
  title: string;
  body: string;
  url?: string;
}
