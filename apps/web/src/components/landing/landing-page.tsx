import { EcosystemSection } from './ecosystem-section';
import { HeroSection } from './hero-section';
import { LandingShell } from './landing-shell';
import { mainPanelBorder } from './landing-panel-border';
import { WorkflowPanel } from './workflow-panel';
import { aiAgentLabel } from './text-styles';

export function LandingPage() {
  return (
    <LandingShell>
      <div className="framer-1vn47iw" data-border="true" style={mainPanelBorder}>
        <HeroSection />
        <EcosystemSection />
        <WorkflowPanel />
        <p className="framer-sk175n" style={aiAgentLabel}>
          AI Agent
        </p>
      </div>
    </LandingShell>
  );
}
