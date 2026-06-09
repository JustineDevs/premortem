export interface UsageMeterEvent {
  organizationId: string;
  auditRunId?: string;
  eventType: 'audit_run' | 'tokens_in' | 'tokens_out' | 'graph_write' | 'publish';
  quantity: number;
  unit: string;
}
