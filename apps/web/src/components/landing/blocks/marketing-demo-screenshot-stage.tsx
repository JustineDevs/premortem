'use client';

type MarketingDemoScreenshotStageProps = {
  src: string;
  alt: string;
  phase: string;
};

export function MarketingDemoScreenshotStage({ src, alt, phase }: MarketingDemoScreenshotStageProps) {
  return (
    <div className="landing-demo-screenshot" aria-hidden>
      <div className="landing-demo-screenshot__chrome">
        <div className="landing-demo-screenshot__dots">
          <span />
          <span />
          <span />
        </div>
        <span className="landing-demo-screenshot__title">Premortem · /app</span>
        <span className="landing-demo-screenshot__phase">{phase}</span>
      </div>
      <div className="landing-demo-screenshot__viewport">
        <img src={src} alt={alt} className="landing-demo-screenshot__img" loading="lazy" decoding="async" />
      </div>
    </div>
  );
}
