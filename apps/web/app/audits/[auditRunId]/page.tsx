import { AuditDetailPage, loadAuditRunSnapshot } from '../../../src/premortem-dashboard';
import { getApiBaseUrl } from '../../../src/lib/runtime-config';

export const dynamic = 'force-dynamic';

export default async function AuditRunDetailPage({ params }: { params: { auditRunId: string } }) {
  const auditRun = await loadAuditRunSnapshot(params.auditRunId, { apiBaseUrl: getApiBaseUrl() });
  return <AuditDetailPage auditRun={auditRun} />;
}
