import { AuditDetailPage } from '../../../src/components/audit-detail-page';
import { loadAuditRunSnapshot } from '../../../src/lib/audit-api';

export default async function AuditRunDetailPage({
  params
}: {
  params: { auditRunId: string };
}) {
  const auditRun = await loadAuditRunSnapshot(params.auditRunId);
  return <AuditDetailPage auditRun={auditRun} />;
}
