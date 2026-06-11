'use client';

import type { MarketingDemoStepId } from '@/content/marketing/pricing';

type CinematicDemoStageProps = {
  stepId: MarketingDemoStepId;
  phase: string;
};

export function MarketingCinematicDemoStage({ stepId, phase }: CinematicDemoStageProps) {
  return (
    <div className="landing-cinematic-demo" data-step={stepId} aria-hidden>
      <div className="landing-cinematic-demo__chrome">
        <div className="landing-cinematic-demo__dots">
          <span />
          <span />
          <span />
        </div>
        <span className="landing-cinematic-demo__title">Premortem · /app</span>
        <span className="landing-cinematic-demo__phase">{phase}</span>
      </div>

      <div className="landing-cinematic-demo__viewport">
        <aside className="landing-cinematic-demo__sidebar">
          <span className="landing-cinematic-demo__nav-item">Dashboard</span>
          <span className="landing-cinematic-demo__nav-item">Audits</span>
          <span
            className={`landing-cinematic-demo__nav-item landing-cinematic-demo__nav-item--active${stepId === 'connect' ? ' landing-cinematic-demo__nav-item--hot' : ''}`}
          >
            Settings
          </span>
          <span className="landing-cinematic-demo__lock">
            Continuous audit <strong>ON</strong>
          </span>
        </aside>

        <div className="landing-cinematic-demo__stage">
          {stepId === 'connect' ? <ConnectScene /> : null}
          {stepId === 'run' ? <RunScene /> : null}
          {stepId === 'review' ? <ReviewScene /> : null}

          <div className="landing-cinematic-demo__cursor" aria-hidden>
            <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
              <path
                d="M1 1L1 16.5L5.5 12.5L8.5 20.5L11 19.5L8 11.5L14 11.5L1 1Z"
                fill="#111"
                stroke="#fff"
                strokeWidth="1.2"
              />
            </svg>
            <span className="landing-cinematic-demo__click-ring" />
          </div>
        </div>
      </div>

      <div className="landing-cinematic-demo__scanline" aria-hidden />
    </div>
  );
}

function ConnectScene() {
  return (
    <>
      <div className="landing-cinematic-demo__panel">
        <p className="landing-cinematic-demo__eyebrow">Integrations</p>
        <h4 className="landing-cinematic-demo__heading">Connect GitLab</h4>
        <div className="landing-cinematic-demo__card">
          <span className="landing-cinematic-demo__badge">GitLab</span>
          <span>meta-architect · main</span>
        </div>
        <button
          type="button"
          className="landing-cinematic-demo__cta landing-cinematic-demo__cta--hot"
          tabIndex={-1}
        >
          Connect repository
        </button>
      </div>
      <div className="landing-cinematic-demo__toast landing-cinematic-demo__toast--connect">
        OAuth complete · repo tree ingested
      </div>
    </>
  );
}

function RunScene() {
  return (
    <>
      <div className="landing-cinematic-demo__panel landing-cinematic-demo__panel--runtime">
        <div className="landing-cinematic-demo__runtime-head">
          <span>Operations Runtime</span>
          <span className="landing-cinematic-demo__live-pill">Live</span>
        </div>
        <div className="landing-cinematic-demo__pipeline">
          {['Ingest', 'Swarm', 'Graph', 'Synthesis', 'Validate'].map((label, index) => (
            <span
              key={label}
              className={`landing-cinematic-demo__pipe-step${index <= 2 ? ' landing-cinematic-demo__pipe-step--done' : ''}${index === 3 ? ' landing-cinematic-demo__pipe-step--active' : ''}`}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="landing-cinematic-demo__agents">
          {['repo_topology_agent', 'ci_pipeline_agent', 'finding_synthesizer_agent'].map((agent, index) => (
            <div
              key={agent}
              className={`landing-cinematic-demo__agent${index < 2 ? ' landing-cinematic-demo__agent--done' : ' landing-cinematic-demo__agent--active'}`}
            >
              <span>{agent}</span>
              <span>{index < 2 ? 'completed' : 'running'}</span>
            </div>
          ))}
        </div>
        <div className="landing-cinematic-demo__terminal">
          <span className="landing-cinematic-demo__terminal-line">
            [02:14:08] audit.graph_built · 21 nodes
          </span>
          <span className="landing-cinematic-demo__terminal-line landing-cinematic-demo__terminal-line--typing">
            finding_synthesizer_agent → running
          </span>
        </div>
      </div>
    </>
  );
}

function ReviewScene() {
  return (
    <>
      <div className="landing-cinematic-demo__panel landing-cinematic-demo__panel--review">
        <p className="landing-cinematic-demo__eyebrow">Issue candidate</p>
        <h4 className="landing-cinematic-demo__heading">Missing rate limit on public API route</h4>
        <p className="landing-cinematic-demo__copy">
          Predicted failure: unbounded traffic bypasses auth middleware under burst load.
        </p>
        <div className="landing-cinematic-demo__chips">
          <span>severity: high</span>
          <span>category: api_security</span>
          <span>confidence: 0.91</span>
        </div>
        <div className="landing-cinematic-demo__actions">
          <button type="button" className="landing-cinematic-demo__ghost-btn" tabIndex={-1}>
            Edit
          </button>
          <button type="button" className="landing-cinematic-demo__ghost-btn" tabIndex={-1}>
            Reject
          </button>
          <button
            type="button"
            className="landing-cinematic-demo__cta landing-cinematic-demo__cta--hot"
            tabIndex={-1}
          >
            Approve & publish
          </button>
        </div>
      </div>
      <div className="landing-cinematic-demo__toast landing-cinematic-demo__toast--review">
        GitLab issue #142 created · premortem label applied
      </div>
    </>
  );
}
