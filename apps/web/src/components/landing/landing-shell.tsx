import './landing.css';
import './landing-responsive.css';

import type { ReactNode } from 'react';

import { AnnouncementBar } from './announcement-bar';
import { LandingFooter } from './landing-footer';
import { LandingScale } from './landing-scale';
import { SiteNavbar } from './site-navbar';

type LandingShellProps = {
  children: ReactNode;
};

export function LandingShell({ children }: LandingShellProps) {
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
          <LandingFooter />
          <AnnouncementBar />
          <SiteNavbar />
        </div>
      </LandingScale>
    </main>
  );
}
