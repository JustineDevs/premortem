import { renderToStaticMarkup } from 'react-dom/server';
import type { AuditRunSnapshot } from '@premortem/orchestrator';
import type { AuditRunListItem } from '@premortem/orchestrator';
import { AuditDetailPage } from './components/audit-detail-page';
import { DashboardHomePage } from './components/dashboard-home-page';
import { LandingPage } from './components/landing-page';

export function renderLandingPageHtml() {
  return `<!doctype html>${renderToStaticMarkup(<LandingPage />)}`;
}

export function renderDashboardHomeHtml(auditRuns: AuditRunListItem[]) {
  return `<!doctype html>${renderToStaticMarkup(<DashboardHomePage auditRuns={auditRuns} />)}`;
}

export function renderAuditDetailHtml(auditRun: AuditRunSnapshot) {
  return `<!doctype html>${renderToStaticMarkup(<AuditDetailPage auditRun={auditRun} />)}`;
}
