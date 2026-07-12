'use client';

import { useEffect, useId, useRef, useState } from 'react';

import Link from 'next/link';

import { marketingLinks } from '@/lib/marketing-links';

import { assets } from './assets';
import { DocumentationLink } from './documentation-link';
import { LogoHomeButton } from './logo-home-button';
import { navCellBorder } from './landing-panel-border';
import { NavLinkButton } from './nav-link-button';
import { StartBuildingButton } from './start-building-button';

const mobileNavLinks = [
  { href: marketingLinks.products, label: 'Products' },
  { href: marketingLinks.solutions, label: 'Solutions' },
  { href: marketingLinks.howItWorks, label: 'How it works' },
  { href: marketingLinks.docs, label: 'Documentation' },
  { href: marketingLinks.signup, label: 'Start building' }
] as const;

export function SiteNavbar() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', onKeyDown);
    }

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!open) return;
      if (shellRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <div
      ref={shellRef}
      className="framer-18z9syq"
      data-open={open ? 'true' : 'false'}
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

      <button
        type="button"
        className="landing-site-navbar__menu-toggle"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setOpen((next) => !next)}
      >
        <span />
        <span />
        <span />
      </button>

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

      <div id={menuId} className="landing-site-navbar__mobile-menu" aria-hidden={!open}>
        <div className="landing-site-navbar__mobile-menu-panel">
          <div className="landing-site-navbar__mobile-menu-links">
            {mobileNavLinks.map((link) => (
              <Link key={link.href} href={link.href} className="landing-site-navbar__mobile-link" onClick={closeMenu}>
                {link.label}
              </Link>
            ))}
          </div>
          <div className="landing-site-navbar__mobile-menu-actions">
            <Link href={marketingLinks.login} className="landing-site-navbar__mobile-action" onClick={closeMenu}>
              Log in
            </Link>
            <Link href={marketingLinks.signup} className="landing-site-navbar__mobile-action landing-site-navbar__mobile-action--primary" onClick={closeMenu}>
              Start building
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
