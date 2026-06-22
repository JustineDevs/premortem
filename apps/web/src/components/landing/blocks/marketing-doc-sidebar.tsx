'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { docsNavSections } from '@/content/marketing/docs-index';
import { marketingLinks } from '@/lib/marketing-links';

import { MarketingDocSearch } from './marketing-doc-primitives';
import { DocsNavLink } from '../nav-link-button';
import { body14, label14 } from '../text-styles';

const NAV_SCROLL_KEY = 'premortem:docs-nav-scroll';

export function MarketingDocSidebar() {
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const isFirstPathnameEffect = useRef(true);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    let restoredFromStorage = false;
    if (isFirstPathnameEffect.current) {
      isFirstPathnameEffect.current = false;
      try {
        const saved = sessionStorage.getItem(NAV_SCROLL_KEY);
        if (saved !== null) {
          nav.scrollTop = Number(saved);
          restoredFromStorage = true;
        }
      } catch {
        // sessionStorage unavailable
      }
    }

    if (restoredFromStorage) return;

    const activeLink = nav.querySelector<HTMLElement>('.landing-doc-nav__link--active');
    if (!activeLink) return;

    const navRect = nav.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const isVisible = linkRect.top >= navRect.top && linkRect.bottom <= navRect.bottom;
    if (!isVisible) {
      activeLink.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [pathname]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const persistScroll = () => {
      try {
        sessionStorage.setItem(NAV_SCROLL_KEY, String(nav.scrollTop));
      } catch {
        // sessionStorage unavailable
      }
    };

    nav.addEventListener('scroll', persistScroll, { passive: true });
    return () => nav.removeEventListener('scroll', persistScroll);
  }, []);

  return (
    <nav ref={navRef} className="landing-doc-nav" aria-label="Documentation">
      <MarketingDocSearch />
      {docsNavSections.map((section) => (
        <details key={section.title} className="landing-doc-nav__section" open>
          <summary className="landing-doc-nav__section-title" style={label14}>
            {section.title}
          </summary>
          <ul className="landing-doc-nav__list">
            {section.items.map((item, index) => (
              <li key={`${item.href}:${item.label}:${index}`}>
                <DocsNavLink href={item.href} matchPrefix={item.href !== marketingLinks.docs} scroll={false}>
                  <span className="landing-doc-nav__label">{item.label}</span>
                  {item.description ? (
                    <span className="landing-doc-nav__desc" style={body14}>
                      {item.description}
                    </span>
                  ) : null}
                </DocsNavLink>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </nav>
  );
}
