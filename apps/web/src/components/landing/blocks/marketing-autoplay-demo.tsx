'use client';

import { useEffect, useState } from 'react';

import {
  marketingDemoFrames,
  marketingDemoStepStartIndex
} from '@/content/marketing/demo-frames';
import { solutionsDemoHighlights, type MarketingDemoStepId } from '@/content/marketing/pricing';
import { premortemSteps } from '@/content/marketing/shared';

import { MarketingDemoScreenshotStage } from './marketing-demo-screenshot-stage';
import { body14, label14, mono12 } from '../text-styles';

const STEP_MS = 3800;

const stepOrder: Record<MarketingDemoStepId, number> = {
  connect: 0,
  run: 1,
  review: 2
};

type MarketingAutoplayDemoProps = {
  variant?: 'how-it-works' | 'solutions';
  autoplay?: boolean;
};

export function MarketingAutoplayDemo({
  variant = 'how-it-works',
  autoplay = true
}: MarketingAutoplayDemoProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [personaIndex, setPersonaIndex] = useState(0);
  const frame = marketingDemoFrames[activeIndex] ?? marketingDemoFrames[0];
  const activeStepId = frame.stepId;
  const activeStepOrder = stepOrder[activeStepId];

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % marketingDemoFrames.length);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [autoplay]);

  useEffect(() => {
    if (!autoplay || variant !== 'solutions') return;
    const timer = window.setInterval(() => {
      setPersonaIndex((current) => (current + 1) % solutionsDemoHighlights.length);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [autoplay, variant]);

  const persona = solutionsDemoHighlights[personaIndex] ?? solutionsDemoHighlights[0];

  function jumpToStep(stepId: MarketingDemoStepId) {
    setActiveIndex(marketingDemoStepStartIndex[stepId]);
  }

  return (
    <section
      className="landing-block-demo"
      aria-label="Premortem workflow walkthrough"
      data-demo-variant={variant}
    >
      <div className="landing-block-demo__steps" aria-label="Workflow steps">
        {premortemSteps.map((step, index) => {
          const isActive = step.id === activeStepId;
          const isPast = index < activeStepOrder;
          return (
            <button
              key={step.id}
              type="button"
              className={`landing-block-demo__step${isActive ? ' landing-block-demo__step--active' : ''}${isPast ? ' landing-block-demo__step--past' : ''}`}
              onClick={() => jumpToStep(step.id)}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="landing-block-demo__step-index">{index + 1}</span>
              <span style={mono12}>{step.title}</span>
            </button>
          );
        })}
      </div>

      <div className="landing-block-demo__panel" data-border="true">
        <div className="landing-block-demo__panel-head">
          <span className="landing-block-demo__phase" style={mono12}>
            {frame.phase}
          </span>
          <span className="landing-block-demo__live" aria-hidden>
            Auto preview
          </span>
        </div>

        <div className="landing-block-demo__preview-wrap">
          <MarketingDemoScreenshotStage
            key={frame.id}
            src={frame.screenshot.src}
            alt={frame.screenshot.alt}
            phase={frame.phase}
          />
          <div className="landing-block-demo__caption" key={`${frame.id}-caption`}>
            <h3 className="landing-block-demo__headline" style={label14}>
              {frame.headline}
            </h3>
            {frame.lines.map((line) => (
              <p key={line} className="landing-block-demo__line" style={body14}>
                {line}
              </p>
            ))}
            <div className="landing-block-demo__metrics">
              {frame.metrics.map((metric) => (
                <div key={metric.label} className="landing-block-demo__metric">
                  <span className="landing-block-demo__metric-label" style={mono12}>
                    {metric.label}
                  </span>
                  <span className="landing-block-demo__metric-value" style={label14}>
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="landing-block-demo__progress" aria-hidden>
          <div
            className="landing-block-demo__progress-bar"
            style={{ width: `${frame.progress}%` }}
          />
        </div>

        <p className="landing-block-demo__log" style={mono12}>
          <span className="landing-block-demo__log-cursor" aria-hidden>
            ›
          </span>{' '}
          {frame.log}
        </p>
      </div>

      {variant === 'solutions' ? (
        <div className="landing-block-demo__persona-strip" key={persona.personaId}>
          {solutionsDemoHighlights.map((item, index) => (
            <button
              key={item.personaId}
              type="button"
              className={`landing-block-demo__persona${index === personaIndex ? ' landing-block-demo__persona--active' : ''}`}
              onClick={() => setPersonaIndex(index)}
            >
              <span style={label14}>{item.title}</span>
              <span className="landing-block-demo__persona-metric" style={mono12}>
                {item.metric}
              </span>
            </button>
          ))}
          <p className="landing-block-demo__persona-detail" style={body14}>
            {persona.detail}
          </p>
        </div>
      ) : null}
    </section>
  );
}
