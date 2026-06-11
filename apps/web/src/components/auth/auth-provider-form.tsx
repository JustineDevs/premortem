'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { authProviderHref, type AuthMode } from '@/lib/auth-links';

import { assets } from '../landing/assets';
import { GitLabLogo } from '../landing/icons/gitlab-logo';
import { body14, label14, navLink, sectionTitle } from '../landing/text-styles';

type AuthProviderFormProps = {
  mode: AuthMode;
  title: string;
  description: string;
  alternateHref: string;
  alternateLabel: string;
};

const notices: Record<string, { message: string; tone: 'warn' | 'error' }> = {
  'github-soon': {
    message: 'GitHub sign-in is coming soon. Use GitLab to continue today.',
    tone: 'warn'
  },
  config: {
    message:
      'Supabase sign-in is not available in this dev server. Restart after setting NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the repository root .env.local.',
    tone: 'error'
  },
  oauth: {
    message:
      'Could not start GitLab sign-in. Check Supabase GitLab provider settings and that your GitLab app enables the read_user scope.',
    tone: 'error'
  },
  callback: {
    message: 'Sign-in could not be completed. Try again.',
    tone: 'error'
  }
};

export function AuthProviderForm({
  mode,
  title,
  description,
  alternateHref,
  alternateLabel
}: AuthProviderFormProps) {
  const searchParams = useSearchParams();
  const noticeKey = searchParams.get('notice') ?? searchParams.get('error');
  const redirectNotice = noticeKey ? notices[noticeKey] : null;
  const [runtimeConfigured, setRuntimeConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch('/api/auth/status')
      .then((response) => response.json())
      .then((payload: { configured?: boolean }) => {
        setRuntimeConfigured(Boolean(payload.configured));
      })
      .catch(() => setRuntimeConfigured(false));
  }, []);

  const notice =
    redirectNotice ??
    (runtimeConfigured === false
      ? notices.config
      : null);

  return (
    <div className="landing-auth-shell">
      <div className="landing-auth-card" data-border="true">
        <header className="landing-auth-card__header">
          <h1 className="landing-auth-card__title" style={sectionTitle}>
            {title}
          </h1>
          <p className="landing-auth-card__lead" style={body14}>
            {description}
          </p>
        </header>

        {notice ? (
          <aside
            className={`landing-auth-notice landing-auth-notice--${notice.tone}`}
            data-border="true"
            role="status"
          >
            <p style={body14}>{notice.message}</p>
          </aside>
        ) : null}

        <div className="landing-auth-card__providers">
          <a
            href={authProviderHref('gitlab', mode)}
            className="landing-auth-provider landing-auth-provider--gitlab"
            data-border="true"
          >
            <GitLabLogo />
            <span style={{ ...navLink, color: 'rgb(255, 255, 255)' }}>Continue with GitLab</span>
          </a>

          <button
            type="button"
            className="landing-auth-provider landing-auth-provider--github"
            data-border="true"
            disabled
            aria-disabled="true"
          >
            <img
              src={assets.githubIcon}
              alt=""
              width={19}
              height={19}
              aria-hidden
              className="landing-auth-provider__github-icon"
            />
            <span style={{ ...navLink, color: 'rgb(255, 255, 255)' }}>Continue with GitHub</span>
            <span className="landing-auth-provider__soon" style={label14}>
              Coming soon
            </span>
          </button>
        </div>

        <footer className="landing-auth-card__footer">
          <Link href={alternateHref} className="landing-route-link">
            {alternateLabel}
          </Link>
        </footer>
      </div>
    </div>
  );
}
