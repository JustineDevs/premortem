import { AuditDetailPage, loadAuditRunSnapshot } from '../../../src/premortem-dashboard';
import { getApiBaseUrl } from '../../../src/lib/runtime-config';
import { requireUserSession } from '../../../src/lib/server/require-user-session';
import { actorHeaders, resolveRequestActorContext } from '../../../src/lib/server/request-context';

export const dynamic = 'force-dynamic';

export default async function AuditRunDetailPage({
  params
}: {
  params: Promise<{ auditRunId: string }>;
}) {
  const { auditRunId } = await params;
  await requireUserSession(`/audits/${auditRunId}`);
  const context = await resolveRequestActorContext();
  const auditRun = await loadAuditRunSnapshot(auditRunId, {
    apiBaseUrl: getApiBaseUrl(),
    headers: actorHeaders(context)
  });
  return <AuditDetailPage auditRun={auditRun} />;
}
