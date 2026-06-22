import { authProviderHref } from '@/lib/auth-links';
import { GitLabLogo } from './icons/gitlab-logo';
import { HeroInfoSection } from './hero-info-section';
import { assets } from './assets';
import {
  body14,
  heroTitle,
  sectionTitle
} from './text-styles';

function WindowChrome() {
  return (
    <>
      <div className="framer-1eomn27" data-border="true" style={chromeStyle()} />
      <div className="framer-td34zo" data-border="true" style={chromeStyle()} />
      <div className="framer-132nv3k" data-border="true" style={chromeStyle()} />
      <div className="framer-1tuzkhp" data-border="true" style={chromeStyle()} />
    </>
  );
}

function chromeStyle() {
  return {
    ['--border-bottom-width' as string]: '1px',
    ['--border-color' as string]: 'rgb(213, 213, 213)',
    ['--border-left-width' as string]: '1px',
    ['--border-right-width' as string]: '1px',
    ['--border-style' as string]: 'solid',
    ['--border-top-width' as string]: '1px',
    backgroundColor: 'rgb(255, 255, 255)',
    borderRadius: 2,
    boxShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px -1px rgba(0, 0, 0, 0.1)'
  };
}

export function HeroSection() {
  return (
    <>
      <img
        src={assets.heroScreenshot}
        alt="Premortem product preview"
        width={778}
        height={417}
        className="framer-1hqqp6l"
        style={{
          borderRadius: 6,
          boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.25)',
          objectFit: 'cover'
        }}
      />
      <div className="framer-1947fpw" data-border="true" style={verticalDivider()} />
      <div className="framer-14tjojm" style={{ opacity: 0.42 }} />

      <h2 className="framer-q0oq8h" style={heroTitle}>
        Run on your repo before it breaks production.
      </h2>

      <div className="framer-evo1ql" style={{ opacity: 0.42 }}>
        <p className="framer-13qiptv" style={body14}>
          Swarm style repo audits, Structured GitLab issues, Multi lens risk analysis
        </p>
      </div>

      <HeroInfoSection />

      <a
        href={authProviderHref('gitlab', 'signup')}
        className="framer-akk7mv"
        data-border="true"
        style={{
          ...buttonShell('rgb(0, 0, 0)'),
          borderRadius: 5
        }}
      >
        <WindowChrome />
        <span className="framer-6oxvv3 landing-cta-label">Connect to</span>
        <GitLabLogo />
      </a>

      <button
        type="button"
        className="framer-mlk6bw"
        data-border="true"
        aria-label="GitHub sign-in not enabled"
        aria-disabled="true"
        disabled
        style={{
          ...buttonShell('rgb(82, 82, 82)'),
          borderRadius: 5
        }}
      >
        <div className="framer-1rk617y" data-border="true" style={chromeStyle()} />
        <div className="framer-z60kjx" data-border="true" style={chromeStyle()} />
        <div className="framer-1dzkffg" data-border="true" style={chromeStyle()} />
        <div className="framer-1cz4zd2" data-border="true" style={chromeStyle()} />
        <span className="framer-115vgtw landing-cta-label landing-cta-label-muted">Connect to</span>
        <img
          src={assets.githubIcon}
          alt=""
          width={19}
          height={19}
          className="framer-a3dd0r"
        />
        <span className="landing-cta-soon">(Roadmap)</span>
      </button>

      <h2 className="framer-jbx38w" style={sectionTitle}>
        Built with / Ecosystem
      </h2>
    </>
  );
}

function verticalDivider() {
  return {
    ['--border-bottom-width' as string]: '0px',
    ['--border-color' as string]: 'rgb(213, 213, 213)',
    ['--border-left-width' as string]: '1px',
    ['--border-right-width' as string]: '0px',
    ['--border-style' as string]: 'solid',
    ['--border-top-width' as string]: '0px'
  };
}

function buttonShell(backgroundColor: string) {
  return {
    ['--border-bottom-width' as string]: '1px',
    ['--border-color' as string]: 'rgb(213, 213, 213)',
    ['--border-left-width' as string]: '1px',
    ['--border-right-width' as string]: '1px',
    ['--border-style' as string]: 'solid',
    ['--border-top-width' as string]: '1px',
    backgroundColor
  };
}
