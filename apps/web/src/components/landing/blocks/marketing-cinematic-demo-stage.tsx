'use client';

import type { MarketingDemoStepId } from '@/content/marketing/pricing';

type CinematicDemoStageProps = {
  stepId: MarketingDemoStepId;
  phase: string;
};

const sidebarNav = [
  'Monitor Dashboard',
  'Projects Inventory',
  'Audits & Tracing',
  'Workflow Canvas',
  'Audit History Logs',
  'Integrations & Scope'
] as const;

export function MarketingCinematicDemoStage({ stepId, phase }: CinematicDemoStageProps) {
  const activeNav =
    stepId === 'connect' ? 'Projects Inventory' : stepId === 'run' ? 'Audits & Tracing' : 'Audits & Tracing';

  return (
    <div className="landing-os-demo" data-step={stepId} aria-hidden>
      <div className="landing-os-demo__chrome">
        <div className="landing-os-demo__dots">
          <span />
          <span />
          <span />
        </div>
        <span className="landing-os-demo__title">Premortem · /app</span>
        <span className="landing-os-demo__phase">{phase}</span>
      </div>

      <div className="landing-os-demo__viewport">
        <aside className="landing-os-demo__sidebar">
          <div className="landing-os-demo__brand">
            <span className="landing-os-demo__brand-mark" aria-hidden />
            <span>Premortem</span>
          </div>
          <p className="landing-os-demo__engine">ENGINE v0.1.0 STABLE</p>
          {sidebarNav.map((item) => (
            <span
              key={item}
              className={`landing-os-demo__nav-item${item === activeNav ? ' landing-os-demo__nav-item--active' : ''}`}
            >
              {item}
            </span>
          ))}
          <div className="landing-os-demo__compliance">
            <span>Compliance index</span>
            <div className="landing-os-demo__compliance-bar">
              <span style={{ width: stepId === 'review' ? '30%' : '48%' }} />
            </div>
          </div>
        </aside>

        <div className="landing-os-demo__main">
          {stepId === 'connect' ? <ConnectScene /> : null}
          {stepId === 'run' ? <RunScene /> : null}
          {stepId === 'review' ? <ReviewScene /> : null}
        </div>
      </div>
    </div>
  );
}

function ConnectScene() {
  return (
    <div className="landing-os-demo__panel landing-os-demo__panel--connect">
      <header className="landing-os-demo__panel-head">
        <h4>Projects Inventory</h4>
        <p>Connect GitLab and enable repositories for audit.</p>
      </header>
      <div className="landing-os-demo__connect-card landing-os-demo__connect-card--hot">
        <span className="landing-os-demo__badge landing-os-demo__badge--gitlab">GitLab</span>
        <div>
          <strong>premortem</strong>
          <p>Repository access · main branch</p>
        </div>
        <button type="button" className="landing-os-demo__btn landing-os-demo__btn--primary" tabIndex={-1}>
          Connect repository
        </button>
      </div>
      <div className="landing-os-demo__toast landing-os-demo__toast--connect">
        OAuth complete · repo tree ingested
      </div>
    </div>
  );
}

function RunScene() {
  return (
    <div className="landing-os-demo__panel landing-os-demo__panel--run">
      <header className="landing-os-demo__panel-head">
        <h4>Continuous Security Audit</h4>
        <p>Operations runtime · premortem · 6/11/2026</p>
      </header>
      <div className="landing-os-demo__runtime">
        <div className="landing-os-demo__runtime-head">
          <span>Operations Runtime</span>
          <span className="landing-os-demo__pill landing-os-demo__pill--live">Live</span>
        </div>
        <div className="landing-os-demo__pipeline">
          {['Ingest', 'Swarm', 'Graph', 'Synthesis', 'Validate'].map((label, index) => (
            <span
              key={label}
              className={`landing-os-demo__pipe-step${index <= 2 ? ' landing-os-demo__pipe-step--done' : ''}${index === 3 ? ' landing-os-demo__pipe-step--active' : ''}`}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="landing-os-demo__terminal">
          <span>[02:14:08] audit.graph_built · 21 nodes</span>
          <span className="landing-os-demo__terminal-active">finding_synthesizer_agent → running</span>
        </div>
      </div>
    </div>
  );
}

function ReviewScene() {
  return (
    <div className="landing-os-demo__audit-layout">
      <aside className="landing-os-demo__targets">
        <p className="landing-os-demo__targets-label">Audit targets</p>
        <div className="landing-os-demo__target landing-os-demo__target--active">
          <strong>premortem</strong>
          <span>6/11/2026</span>
          <span className="landing-os-demo__target-score landing-os-demo__target-score--warn">30/100</span>
          <span>11 open risks</span>
        </div>
        <div className="landing-os-demo__target">
          <strong>premortem</strong>
          <span>6/11/2026</span>
          <span className="landing-os-demo__target-score">100/100</span>
          <span>0 open risks</span>
        </div>
      </aside>

      <div className="landing-os-demo__audit-main">
        <header className="landing-os-demo__audit-head">
          <div>
            <p className="landing-os-demo__audit-ref">REF: 6AEE964E · Audited 6/11/2026</p>
            <h4>premortem Continuous Security Audit</h4>
          </div>
          <div className="landing-os-demo__gauge">
            <span>30%</span>
            <small>Compliance</small>
          </div>
        </header>

        <div className="landing-os-demo__tabs">
          <span>Compliance Summary</span>
          <span className="landing-os-demo__tabs-item--active">Trace Investigations</span>
          <span>Swarm Orchestration Plan</span>
        </div>

        <div className="landing-os-demo__review-split">
          <ul className="landing-os-demo__findings">
            <li className="landing-os-demo__finding landing-os-demo__finding--active">
              <span className="landing-os-demo__severity landing-os-demo__severity--medium">Medium</span>
              <span>Contain artifact integrity failures before production rollout</span>
              <span className="landing-os-demo__finding-status">Open</span>
            </li>
            <li className="landing-os-demo__finding">
              <span className="landing-os-demo__severity landing-os-demo__severity--high">High</span>
              <span>Missing rate limit on public API route</span>
              <span className="landing-os-demo__finding-status">Open</span>
            </li>
          </ul>

          <div className="landing-os-demo__detail">
            <p className="landing-os-demo__detail-label">Section 4 · Success conditions for closure</p>
            <div className="landing-os-demo__detail-field">
              Testable criteria that prove the risk is resolved in CI and runtime.
            </div>
            <p className="landing-os-demo__detail-label">Section 5 · Why it matters</p>
            <div className="landing-os-demo__detail-field">
              Predicted failure under burst load before production rollout.
            </div>
            <button type="button" className="landing-os-demo__btn landing-os-demo__btn--approve" tabIndex={-1}>
              Approve &amp; create GitLab issue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
