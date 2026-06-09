import { marketingLinks } from '@/lib/marketing-links';

import { assets } from './assets';
import { DocumentationLink } from './documentation-link';
import { LogoHomeButton } from './logo-home-button';
import { navCellBorder } from './landing-panel-border';
import { NavLinkButton } from './nav-link-button';
import { StartBuildingButton } from './start-building-button';

export function SiteNavbar() {
  return (
    <div
      className="framer-18z9syq"
      data-border="true"
      style={{
        ['--border-bottom-width' as string]: '1px',
        ['--border-color' as string]: 'rgb(228, 227, 222)',
        ['--border-left-width' as string]: '0px',
        ['--border-right-width' as string]: '0px',
        ['--border-style' as string]: 'solid',
        ['--border-top-width' as string]: '0px',
        backgroundColor: 'rgb(251, 251, 248)'
      }}
    >
      <LogoHomeButton>
        <img
          src={assets.premortemMark}
          alt="Premortem"
          width={30}
          height={28}
          className="framer-1g03svv"
        />
      </LogoHomeButton>

      <div
        className="framer-17vworx"
        data-border="true"
        style={{
          ['--border-bottom-width' as string]: '0px',
          ['--border-color' as string]: 'rgb(228, 227, 222)',
          ['--border-left-width' as string]: '0px',
          ['--border-right-width' as string]: '1px',
          ['--border-style' as string]: 'solid',
          ['--border-top-width' as string]: '0px'
        }}
      >
        <NavLinkButton
          href={marketingLinks.products}
          className="framer-xizbix"
          borderStyle={navCellBorder}
          matchPrefix
        >
          Products
        </NavLinkButton>
        <NavLinkButton
          href={marketingLinks.solutions}
          className="framer-1ddzhjc"
          borderStyle={navCellBorder}
          matchPrefix
        >
          Solutions
        </NavLinkButton>
        <NavLinkButton
          href={marketingLinks.howItWorks}
          className="framer-16j3yss"
          borderStyle={navCellBorder}
          matchPrefix
        >
          How it works
        </NavLinkButton>
      </div>

      <StartBuildingButton />
      <DocumentationLink />
    </div>
  );
}
