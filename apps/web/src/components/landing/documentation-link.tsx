'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { marketingLinks } from '@/lib/marketing-links';

import { navLink } from './text-styles';

export function DocumentationLink() {
  const pathname = usePathname();
  const isActive = pathname === marketingLinks.docs || pathname.startsWith(`${marketingLinks.docs}/`);

  return (
    <Link
      href={marketingLinks.docs}
      className={`landing-nav-link landing-nav-link--docs framer-twzyhj${isActive ? ' landing-nav-link--active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="framer-bwi5md" style={{ ...navLink, color: 'rgb(255, 255, 255)' }}>
        Documentation
      </span>
    </Link>
  );
}
