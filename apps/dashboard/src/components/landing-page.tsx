const shellCard = {
  borderRadius: 28,
  border: '1px solid rgba(233, 210, 170, 0.72)',
  background: 'rgba(255, 251, 242, 0.88)',
  boxShadow: '0 22px 60px rgba(64, 39, 11, 0.08)'
} as const;

const accentPill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid rgba(182, 119, 55, 0.26)',
  background: 'rgba(255, 242, 214, 0.88)',
  color: '#8b5726',
  fontSize: 13,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 700
} as const;

const featureCard = {
  ...shellCard,
  padding: 24,
  display: 'grid',
  gap: 12
} as const;

const pageStyle = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, rgba(255,239,196,0.95) 0%, rgba(248,242,231,0.96) 30%, rgba(244,238,230,1) 100%)',
  color: '#2f2518',
  padding: '32px 20px 80px',
  fontFamily: '"IBM Plex Sans", "Avenir Next", sans-serif'
} as const;

const layoutStyle = {
  maxWidth: 1160,
  margin: '0 auto',
  display: 'grid',
  gap: 24
} as const;

const heroSectionStyle = {
  ...shellCard,
  padding: '48px 42px',
  display: 'grid',
  gap: 24,
  overflow: 'hidden',
  position: 'relative',
  background:
    'linear-gradient(145deg, rgba(255,251,243,0.98), rgba(255,237,198,0.88) 48%, rgba(247,228,188,0.96) 100%)'
} as const;

const heroOrbStyle = {
  position: 'absolute',
  inset: 'auto -120px -140px auto',
  width: 340,
  height: 340,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(193,125,52,0.2), rgba(193,125,52,0))'
} as const;

const heroGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)',
  gap: 28,
  alignItems: 'start'
} as const;

const heroAsideStyle = {
  ...shellCard,
  padding: 24,
  background: 'rgba(255, 250, 241, 0.94)',
  display: 'grid',
  gap: 18
} as const;

const workflowGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 18
} as const;

const traceabilitySectionStyle = {
  ...shellCard,
  padding: '34px 30px',
  display: 'grid',
  gap: 18
} as const;

const bulletBadgeStyle = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#2f2518',
  color: '#fff8ea',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700
} as const;

export function LandingPage() {
  return (
    <main style={pageStyle}>
      <section style={layoutStyle}>
        <header
          style={{
            ...shellCard,
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 18,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ fontSize: 20 }}>Premortem</strong>
            <span style={{ color: '#6c5642', fontSize: 14 }}>
              GitLab-first predictive audit system for reviewer-ready issue publishing.
            </span>
          </div>
          <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a
              href="#workflow"
              style={{ color: '#694d30', textDecoration: 'none', fontWeight: 600 }}
            >
              Workflow
            </a>
            <a
              href="#traceability"
              style={{ color: '#694d30', textDecoration: 'none', fontWeight: 600 }}
            >
              Traceability
            </a>
            <a href="/app" style={{ padding: '10px 16px', borderRadius: 999, background: '#2f2518', color: '#fff8ea', textDecoration: 'none', fontWeight: 700 }}>
              Open Reviewer Console
            </a>
          </nav>
        </header>

        <section
          style={heroSectionStyle}
        >
          <div style={heroOrbStyle} />
          <span style={accentPill}>v0.1.0 locked scope • GitLab-first • reviewer-first</span>
          <div style={heroGridStyle}>
            <div style={{ display: 'grid', gap: 18 }}>
              <h1 style={{ margin: 0, fontSize: 56, lineHeight: 0.95, maxWidth: 760 }}>
                Turn repository risk into reviewable, publishable GitLab issues.
              </h1>
              <p style={{ margin: 0, maxWidth: 700, fontSize: 19, lineHeight: 1.55, color: '#55412d' }}>
                Premortem runs bounded async audits, validates specialist findings, clusters only when overlap is strong,
                and hands reviewers an evidence-backed queue instead of raw model output.
              </p>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <a href="/app" style={{ padding: '14px 20px', borderRadius: 999, background: '#2f2518', color: '#fffaf1', textDecoration: 'none', fontWeight: 700 }}>
                  Enter Reviewer Flow
                </a>
                <a href="/app" style={{ padding: '14px 20px', borderRadius: 999, border: '1px solid #c89d6c', color: '#6d4726', textDecoration: 'none', fontWeight: 700 }}>
                  Browse reviewer queue
                </a>
              </div>
            </div>

            <aside style={heroAsideStyle}>
              <div>
                <p style={{ margin: 0, color: '#8c6239', textTransform: 'uppercase', letterSpacing: '0.09em', fontSize: 12 }}>
                  Demo path
                </p>
                <strong style={{ display: 'block', marginTop: 8, fontSize: 22 }}>
                  One project. One branch. One bounded audit. One approved issue.
                </strong>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {[
                  'Connect one GitLab project and select one branch.',
                  'Enqueue one bounded audit run with traceable agent execution.',
                  'Review candidates backed by evidence and validation state.',
                  'Approve one issue and publish it back to GitLab.'
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22px 1fr',
                      gap: 12,
                      alignItems: 'start'
                    }}
                  >
                    <span style={bulletBadgeStyle}>
                      •
                    </span>
                    <span style={{ color: '#5b4734', lineHeight: 1.45 }}>{item}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section id="workflow" style={workflowGridStyle}>
          {[
            ['Connect', 'GitLab project connection stays provider-scoped and server-authorized.'],
            ['Ingest', 'Bounded ingestion collects repo tree, CI files, manifests, docs, and selected config only.'],
            ['Validate', 'Schema-invalid or weakly evidenced outputs do not enter the normal review queue.'],
            ['Review', 'Reviewers compare candidates, inspect evidence, and keep edits append-only and versioned.'],
            ['Publish', 'Approved issues publish to GitLab and reconciliation confirms external state.']
          ].map(([title, body]) => (
            <article key={title} style={featureCard}>
              <span style={accentPill}>{title}</span>
              <h2 style={{ margin: 0, fontSize: 24 }}>{title}</h2>
              <p style={{ margin: 0, lineHeight: 1.55, color: '#5a4631' }}>{body}</p>
            </article>
          ))}
        </section>

        <section id="traceability" style={traceabilitySectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, color: '#8c6239', textTransform: 'uppercase', letterSpacing: '0.09em', fontSize: 12 }}>
                Trust boundary
              </p>
              <h2 style={{ margin: '8px 0 0', fontSize: 30 }}>Traceability is the product contract.</h2>
            </div>
            <a href="/app" style={{ alignSelf: 'start', padding: '12px 16px', borderRadius: 999, border: '1px solid #c89d6c', color: '#6d4726', textDecoration: 'none', fontWeight: 700 }}>
              Review live runs
            </a>
          </div>
          <p style={{ margin: 0, maxWidth: 820, color: '#5b4734', lineHeight: 1.6 }}>
            Nothing becomes publishable just because a model emitted it. Premortem preserves the chain from prompt version
            to agent run, finding, cluster, issue candidate, reviewer action, published issue, and reconciliation event.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12
            }}
          >
            {[
              'Prompt version',
              'Agent run',
              'Validated finding',
              'Conservative cluster',
              'Issue candidate version',
              'Reviewer decision',
              'Published GitLab issue',
              'Reconciliation event'
            ].map((label) => (
              <div
                key={label}
                style={{
                  padding: '16px 14px',
                  borderRadius: 16,
                  background: '#fff7e8',
                  border: '1px solid #ead5a7',
                  fontWeight: 700
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
