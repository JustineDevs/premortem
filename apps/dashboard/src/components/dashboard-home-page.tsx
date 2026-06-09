import type { AuditRunListItem } from '@premortem/orchestrator';

export function DashboardHomePage({ auditRuns }: { auditRuns: AuditRunListItem[] }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, rgba(255,248,231,1) 0%, rgba(245,240,231,1) 100%)',
        color: '#2f2518',
        padding: 40,
        fontFamily: '"IBM Plex Sans", "Avenir Next", sans-serif'
      }}
    >
      <section
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          display: 'grid',
          gap: 24
        }}
      >
        <header
          style={{
            borderRadius: 24,
            padding: 32,
            background: '#fffdf6',
            border: '1px solid #ead5a7',
            boxShadow: '0 18px 38px rgba(70, 39, 16, 0.08)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8c6239', fontSize: 13 }}>
              Premortem Reviewer Console
            </p>
            <a
              href="/"
              style={{
                color: '#6b4b2b',
                textDecoration: 'none',
                fontWeight: 700
              }}
            >
              Back to landing page
            </a>
          </div>
          <h1 style={{ margin: '12px 0 8px', fontSize: 38, lineHeight: 1.05 }}>
            Recent audits ready for reviewer triage.
          </h1>
          <p style={{ margin: 0, maxWidth: 760, color: '#5a4631', fontSize: 17 }}>
            This page is backed by <code>GET /api/audits</code> and routes reviewers into the canonical audit detail view
            without bypassing validation, versioning, or publish review gates.
          </p>
        </header>

        <section
          style={{
            borderRadius: 24,
            padding: 24,
            background: '#fffdf6',
            border: '1px solid #ead5a7',
            boxShadow: '0 18px 38px rgba(70, 39, 16, 0.08)',
            display: 'grid',
            gap: 16
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>Recent audit runs</h2>
            <span style={{ color: '#6f5943' }}>{auditRuns.length} visible runs</span>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {auditRuns.map((auditRun) => (
              <a
                key={auditRun.auditRunId}
                href={`/audits/${auditRun.auditRunId}`}
                style={{
                  display: 'grid',
                  gap: 10,
                  padding: 18,
                  borderRadius: 18,
                  border: '1px solid #ead5a7',
                  background: '#fff8ea',
                  color: 'inherit',
                  textDecoration: 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 18 }}>
                    {auditRun.projectId} / {auditRun.branch}
                  </strong>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: auditRun.runStatus === 'completed' ? '#dff7df' : '#fce4d6',
                      color: auditRun.runStatus === 'completed' ? '#196c2e' : '#8d2f18',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontSize: 12
                    }}
                  >
                    {auditRun.runStatus}
                  </span>
                </div>
                <div style={{ color: '#5a4631' }}>
                  <div>Audit run: {auditRun.auditRunId}</div>
                  <div>Commit: {auditRun.commitSha ?? 'unbound'}</div>
                  <div>Latest event: {auditRun.latestEventType ?? 'none yet'}</div>
                </div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: '#6f5943' }}>
                  <span>{auditRun.reviewableIssueCount} reviewable issues</span>
                  <span>{auditRun.rejectedIssueCount} rejected artifacts</span>
                  <span>{new Date(auditRun.createdAt).toLocaleString()}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
