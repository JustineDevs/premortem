import type { ReactNode } from 'react';

import './landing-responsive.css';
import './landing.css';

import { LandingScale } from './landing-scale';
import { MarketingChrome } from './marketing-chrome';
import { MarketingFooter } from './marketing-footer';

type MarketingShellProps = {
  children: ReactNode;
};

export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <main
      className="landing-root"
      style={{
        width: '100%',
        margin: 0,
        padding: 0,
        background: '#ffffff',
        overflow: 'hidden'
      }}
    >
      <LandingScale>
        <div
          className="landing framer-zjzg50 framer-12tcy6h"
          style={{ backgroundColor: 'rgb(255, 255, 255)' }}
        >
          {children}
          <MarketingFooter />
          <MarketingChrome />
        </div>
      </LandingScale>
    </main>
  );
}
