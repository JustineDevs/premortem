import { label14, mono12 } from './text-styles';
import { premortemFeatures, premortemSteps } from '@/content/marketing/shared';

export function HeroInfoSection() {
  return (
    <div className="landing-info-grid">
      <h4
        className="framer-gmr6ri landing-info-grid__title landing-info-grid__title--steps"
        style={label14}
      >
        How it works
      </h4>
      <div className="landing-info-grid__content landing-info-grid__content--steps">
        <div className="framer-1qyuf7t landing-info-steps">
          {premortemSteps.map((step) => (
            <div key={step.id} className="landing-info-steps__col">
              <p style={mono12}>{step.title}</p>
              {step.lines.map((line) => (
                <p key={line} style={mono12}>
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div
        className="framer-z3s28x landing-info-grid__rule"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)', borderRadius: 100 }}
        aria-hidden
      />

      <h4
        className="framer-erio8z landing-info-grid__title landing-info-grid__title--features"
        style={label14}
      >
        Features
      </h4>
      <div className="landing-info-grid__content landing-info-grid__content--features">
        <div className="framer-14e1npc landing-info-features">
          {premortemFeatures.map((feature) => (
            <p key={feature} style={mono12}>
              {feature}
            </p>
          ))}
        </div>
      </div>

      <div
        className="framer-w8vvjb landing-info-grid__rule landing-info-grid__rule--features"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)', borderRadius: 100 }}
        aria-hidden
      />
    </div>
  );
}
