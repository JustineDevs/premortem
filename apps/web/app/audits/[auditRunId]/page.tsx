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
  try {
    const auditRun = await loadAuditRunSnapshot(auditRunId, {
      apiBaseUrl: getApiBaseUrl(),
      headers: actorHeaders(context)
    });
    return <AuditDetailPage auditRun={auditRun} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The backend service is not available yet.';

    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6 py-16 text-center">
        <section className="rounded-3xl border border-[#EAE6DF] bg-white p-8 shadow-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8A958F]">Audit detail</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#1E2522]">
            Backend deployment is still coming online
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5C6560]">
            The audit page is ready, but the backend snapshot could not be loaded right now.
          </p>
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
            {message}
          </p>
          <p className="mt-4 text-xs leading-6 text-[#8A958F]">
            Once the Alibaba Cloud ECS API is reachable, this page will render the live audit detail view again.
          </p>
        </section>
      </main>
    );
  }
}
