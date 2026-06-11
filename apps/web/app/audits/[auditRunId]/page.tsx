import { AuditDetailPage, loadAuditRunSnapshot } from '../../../src/premortem-dashboard';
import { getApiBaseUrl } from '../../../src/lib/runtime-config';
import { requireUserSession } from '../../../src/lib/server/require-user-session';
import { actorHeaders, resolveRequestActorContext } from '../../../src/lib/server/request-context';

export const dynamic = 'force-dynamic';

export default async function AuditRunDetailPage({ params }: { params: { auditRunId: string } }) {
  await requireUserSession(`/audits/${params.auditRunId}`);
  const context = await resolveRequestActorContext();
  const auditRun = await loadAuditRunSnapshot(params.auditRunId, {
    apiBaseUrl: getApiBaseUrl(),
    headers: actorHeaders(context)
  });
  return <AuditDetailPage auditRun={auditRun} />;
}
