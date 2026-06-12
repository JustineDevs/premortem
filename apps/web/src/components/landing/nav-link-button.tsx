'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';

import { navLink } from './text-styles';

type NavLinkButtonProps = {
  href: string;
  className: string;
  borderStyle: CSSProperties;
  children: string;
  matchPrefix?: boolean;
};

export function NavLinkButton({
  href,
  className,
  borderStyle,
  children,
  matchPrefix = false
}: NavLinkButtonProps) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (matchPrefix && href !== '/' && pathname?.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={`landing-nav-link ${isActive ? 'landing-nav-link--active' : ''} ${className}`}
      data-border="true"
      style={borderStyle}
      aria-current={isActive ? 'page' : undefined}
    >
      <span style={navLink}>{children}</span>
    </Link>
  );
}

type DocsNavLinkProps = {
  href: string;
  children: ReactNode;
  matchPrefix?: boolean;
  scroll?: boolean;
};

export function DocsNavLink({ href, children, matchPrefix = false, scroll }: DocsNavLinkProps) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (matchPrefix && href !== '/' && pathname?.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      scroll={scroll}
      className={`landing-doc-nav__link${isActive ? ' landing-doc-nav__link--active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}
