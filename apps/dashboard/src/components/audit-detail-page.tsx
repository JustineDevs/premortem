import type { AuditRunSnapshot } from '@premortem/orchestrator';

function sectionCardStyle() {
  return {
    background: '#fffef8',
    border: '1px solid #e2d6bc',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 18px 38px rgba(70, 39, 16, 0.08)'
  } as const;
}

function statTileStyle() {
  return {
    background: '#fcf2da',
    borderRadius: 16,
    padding: 16,
    border: '1px solid #ead5a7'
  } as const;
}

export function AuditDetailPage({ auditRun }: { auditRun: AuditRunSnapshot }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, rgba(255,240,198,0.9), rgba(248,242,230,0.96) 42%, rgba(244,238,229,1) 100%)',
        color: '#2f2518',
        padding: '40px 24px 72px',
        fontFamily: '"IBM Plex Sans", "Avenir Next", sans-serif'
      }}
    >
      <section
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          display: 'grid',
          gap: 24
        }}
      >
        <header
          style={{
            ...sectionCardStyle(),
            display: 'grid',
            gap: 18,
            background:
              'linear-gradient(135deg, rgba(255,252,244,0.97), rgba(255,239,201,0.93))'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8c6239' }}>
                Reviewer Audit Detail
              </p>
              <h1 style={{ margin: '10px 0 8px', fontSize: 34, lineHeight: 1.05 }}>
                Audit {auditRun.auditRunId}
              </h1>
              <p style={{ margin: 0, fontSize: 16, color: '#5a4631' }}>
                Branch <strong>{auditRun.branch}</strong> for project <strong>{auditRun.projectId}</strong>
              </p>
            </div>
            <div
              style={{
                alignSelf: 'start',
                padding: '10px 14px',
                borderRadius: 999,
                background: auditRun.runStatus === 'completed' ? '#dff7df' : '#fce4d6',
                color: auditRun.runStatus === 'completed' ? '#196c2e' : '#8d2f18',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}
            >
              {auditRun.runStatus}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div style={statTileStyle()}>
              <strong>{auditRun.counts.findings}</strong>
              <div>Validated findings</div>
            </div>
            <div style={statTileStyle()}>
              <strong>{auditRun.counts.clusters}</strong>
              <div>Conservative clusters</div>
            </div>
            <div style={statTileStyle()}>
              <strong>{auditRun.counts.issueCandidates}</strong>
              <div>Reviewable issues</div>
            </div>
            <div style={statTileStyle()}>
              <strong>{auditRun.counts.rejectedIssueCandidateArtifacts}</strong>
              <div>Rejected artifacts</div>
            </div>
            <div style={statTileStyle()}>
              <strong>{auditRun.counts.events}</strong>
              <div>Trace events</div>
            </div>
          </div>
        </header>

        <section style={{ ...sectionCardStyle(), display: 'grid', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Traceability</h2>
          <p style={{ margin: 0, color: '#5a4631' }}>
            Prompt lineage remains reviewable through agent runs, validated findings, conservative clustering, issue candidates,
            and the final publish gate.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {auditRun.events.map((event: AuditRunSnapshot['events'][number]) => (
              <div
                key={`${event.eventType}-${event.createdAt}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: '#f8edd7'
                }}
              >
                <strong>{event.eventType}</strong>
                <span style={{ color: '#6f5943' }}>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...sectionCardStyle(), display: 'grid', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Review Queue</h2>
          <div style={{ display: 'grid', gap: 14 }}>
            {auditRun.issueCandidates.map((issue: AuditRunSnapshot['issueCandidates'][number]) => (
              <article
                key={issue.id}
                style={{
                  borderRadius: 16,
                  padding: 18,
                  border: '1px solid #ead5a7',
                  background: '#fffaf0'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 18 }}>{issue.title}</strong>
                  <span style={{ color: '#6f5943' }}>
                    {issue.validationStatus} / {issue.reviewerStatus}
                  </span>
                </div>
                <p style={{ margin: '10px 0 0', color: '#5a4631' }}>
                  Versions: {issue.versionCount} | Validation passes: {issue.validationResultCount}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ ...sectionCardStyle(), display: 'grid', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Rejected Validation Artifacts</h2>
          {auditRun.rejectedIssueCandidates.length === 0 ? (
            <p style={{ margin: 0, color: '#5a4631' }}>
              No rejected issue candidates were produced for this audit run.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {auditRun.rejectedIssueCandidates.map((issue: AuditRunSnapshot['rejectedIssueCandidates'][number]) => (
                <article
                  key={issue.id}
                  style={{
                    borderRadius: 16,
                    padding: 18,
                    background: '#fff2ee',
                    border: '1px solid #f2b6a5'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{issue.title}</strong>
                    <span>{issue.category}</span>
                  </div>
                  <p style={{ margin: '10px 0 0', color: '#7a3f27' }}>
                    {issue.validatorName} rejected this artifact with {issue.validationErrorCount} validation errors.
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
