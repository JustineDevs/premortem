'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { authLinks, type AuthMode } from '@/lib/auth-links';
import { marketingLinks } from '@/lib/marketing-links';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

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
  const noticeKey = searchParams?.get('notice') ?? searchParams?.get('error');
  const redirectNotice = noticeKey ? notices[noticeKey] : null;
  const [runtimeConfigured, setRuntimeConfigured] = useState<boolean | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsNotice, setTermsNotice] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const nextPath = searchParams?.get('next') ?? authLinks.defaultNext;

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
    (termsNotice ? { message: 'Accept the Privacy Policy and Terms of Service to continue.', tone: 'warn' as const } : null) ??
    (runtimeConfigured === false ? notices.config : null);

  async function handleGitLabOAuth() {
    if (!agreedToTerms) {
      setTermsNotice(true);
      return;
    }

    if (isSigningIn) return;

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    setIsSigningIn(true);
    try {
      const redirectTo = new URL(authLinks.callback, window.location.origin);
      redirectTo.searchParams.set('next', nextPath);
      redirectTo.searchParams.set('mode', mode);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'gitlab',
        options: {
          redirectTo: redirectTo.toString(),
          scopes: 'read_user api read_repository'
        }
      });

      if (error) {
        window.location.assign(`${authLinks.login}?error=oauth`);
        return;
      }

      if (data.url) {
        window.location.assign(data.url);
      }
    } catch {
      window.location.assign(`${authLinks.login}?error=oauth`);
    } finally {
      setIsSigningIn(false);
    }
  }

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

        <label className="landing-auth-terms">
          <input
            type="checkbox"
            className="landing-auth-terms__input"
            checked={agreedToTerms}
            onChange={(event) => {
              setAgreedToTerms(event.target.checked);
              if (event.target.checked) {
                setTermsNotice(false);
              }
            }}
          />
          <span className="landing-auth-terms__copy" style={body14}>
            I agree to the{' '}
            <Link href={marketingLinks.privacy} className="landing-route-link">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href={marketingLinks.terms} className="landing-route-link">
              Terms of Service
            </Link>
            .
          </span>
        </label>

        <div className="landing-auth-card__providers">
          <button
            type="button"
            className="landing-auth-provider landing-auth-provider--gitlab"
            data-border="true"
            onClick={() => void handleGitLabOAuth()}
            aria-disabled={!agreedToTerms || isSigningIn}
            disabled={isSigningIn}
          >
            <GitLabLogo />
            <span style={{ ...navLink, color: 'rgb(255, 255, 255)' }}>
              {isSigningIn ? 'Redirecting' : 'Continue with GitLab'}
            </span>
          </button>

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
            <span className="landing-auth-provider__soon">
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
