import { DashboardHomePage } from '../../src/components/dashboard-home-page';
import { loadRecentAuditRuns } from '../../src/lib/audit-api';

export default async function ReviewerConsolePage() {
  const auditRuns = await loadRecentAuditRuns();
  return <DashboardHomePage auditRuns={auditRuns} />;
}
