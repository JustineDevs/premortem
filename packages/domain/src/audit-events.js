/** Audit lifecycle events: aligned with orchestrator `recordAuditEvent` payloads. */
export const AuditEvent = {
    ENQUEUED: 'audit.enqueued',
    STARTED: 'audit.started',
    INGESTION_COMPLETED: 'audit.ingestion_completed',
    GRAPH_BUILT: 'audit.graph_built',
    ISSUE_VALIDATION_REJECTED: 'audit.issue_validation_rejected',
    COMPLETED: 'audit.completed',
    FAILED: 'audit.failed',
    CANCELLED: 'audit.cancelled',
    PAUSED: 'audit.paused',
    RESUMED: 'audit.resumed',
    CHECKPOINT_SAVED: 'audit.checkpoint_saved'
};
export const AUDIT_PIPELINE_EVENTS = [
    AuditEvent.ENQUEUED,
    AuditEvent.STARTED,
    AuditEvent.INGESTION_COMPLETED,
    AuditEvent.GRAPH_BUILT,
    AuditEvent.COMPLETED
];
export function hasAuditEvent(events, event) {
    return events.includes(event);
}
