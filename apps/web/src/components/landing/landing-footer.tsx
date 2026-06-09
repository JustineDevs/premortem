import Link from 'next/link';

import { marketingLinks } from '@/lib/marketing-links';

import { inter } from './text-styles';

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <p className="framer-1h6hk4o" style={{ ...inter, color: 'rgb(92, 92, 92)', margin: 0 }}>
        <a
          className="landing-footer__link"
          href={marketingLinks.license}
          target="_blank"
          rel="noopener noreferrer"
        >
          © Premortem
        </a>
      </p>
      <p
        className="framer-1e8egzw"
        style={{ ...inter, color: 'rgb(92, 92, 92)', fontSize: 13, margin: 0 }}
      >
        Maintained by{' '}
        <Link
          className="landing-footer__link landing-footer__link--strong"
          href={marketingLinks.maintainer}
          target="_blank"
          rel="noopener noreferrer"
        >
          @Justindevs
        </Link>
      </p>
    </footer>
  );
}
