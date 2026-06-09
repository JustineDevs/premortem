import Link from 'next/link';

import { marketingLinks } from '@/lib/marketing-links';

import { assets } from './assets';
import { announcementLink, announcementText, utilityLink } from './text-styles';

export function AnnouncementBar() {
  return (
    <div className="framer-2jwdfd" style={{ backgroundColor: 'rgb(245, 244, 239)' }}>
      <img
        src={assets.announcementIcon}
        alt=""
        className="framer-6wvjaw"
        width={14}
        height={14}
      />
      <p className="framer-bvzkf2" style={announcementText}>
        Announcement updates version release today!{' '}
      </p>
      <a
        href={marketingLinks.releases}
        className="framer-1gq3p0c landing-bar-link"
        style={announcementLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        Releases
      </a>
      <Link href={marketingLinks.privacy} className="framer-6a7q8a landing-bar-link" style={utilityLink}>
        Privacy
      </Link>
      <div
        className="framer-1wdo7p1"
        style={{ backgroundColor: 'rgb(42, 42, 42)', width: 1 }}
      />
      <Link href={marketingLinks.terms} className="framer-123udf3 landing-bar-link" style={utilityLink}>
        Terms
      </Link>
      <a
        href={marketingLinks.social.x}
        className="landing-bar-link landing-bar-link--icon framer-ak5sfx"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X (Twitter)"
      >
        <svg viewBox="0 0 24 24" fill="#2A2A2A" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
      <a
        href={marketingLinks.social.linkedin}
        className="landing-bar-link landing-bar-link--icon framer-86h352"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn"
      >
        <svg viewBox="0 0 24 24" fill="#2A2A2A" aria-hidden>
          <path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 1 1 8.3 6.5a1.78 1.78 0 0 1-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0 0 13 14.19a.66.66 0 0 0 0 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 0 1 2.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
        </svg>
      </a>
      <a
        href={marketingLinks.social.github}
        className="landing-bar-link landing-bar-link--icon framer-zmtm87"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
      >
        <img src={assets.socialGithubIcon} alt="" width={16} height={16} />
      </a>
    </div>
  );
}
