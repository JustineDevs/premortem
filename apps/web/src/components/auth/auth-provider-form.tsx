'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createBrowserClient } from '@supabase/ssr';

import { authLinks, authProviderHref, type AuthMode } from '@/lib/auth-links';
import { marketingLinks } from '@/lib/marketing-links';

import { assets } from '../landing/assets';
import { GitLabLogo } from '../landing/icons/gitlab-logo';
import { body14, navLink, sectionTitle } from '../landing/text-styles';

type AuthProviderFormProps = {
  mode: AuthMode;
  title: string;
  description: string;
  alternateHref: string;
  alternateLabel: string;
};

type AuthStatusPayload = {
  configured?: boolean;
  authenticated?: boolean;
  mode?: string;
  captchaEnabled?: boolean;
  captchaConfigured?: boolean;
  captchaSiteKey?: string | null;
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
};

const notices: Record<string, { message: string; tone: 'warn' | 'error' }> = {
  'github-soon': {
    message: 'GitHub sign-in is not enabled in this release. Use GitLab to continue.',
    tone: 'warn'
  },
  config: {
    message:
      'Supabase sign-in is not available in this environment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or the SUPABASE_URL and SUPABASE_ANON_KEY fallback pair, then restart.',
    tone: 'error'
  },
  oauth: {
    message:
      'Could not start GitLab sign-in. Check Supabase GitLab provider settings and that your GitLab app enables the read_user scope.',
    tone: 'error'
  },
  callback: {
    message:
      'Supabase sign-in could not be completed. The external code exchange failed or the callback host did not match the configured origin. Try again from the same browser session.',
    tone: 'error'
  },
  captcha: {
    message:
      'Complete the Cloudflare Turnstile widget to continue.',
    tone: 'warn'
  },
  'captcha-config': {
    message:
      'Cloudflare Turnstile is not configured in this environment. Add both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY in Cloudflare Pages or Workers, then restart.',
    tone: 'error'
  }
};

type TurnstileWidget = {
  render(container: HTMLElement, options: {
    sitekey: string;
    action?: string;
    callback?: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: (message?: string) => void;
  }): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

const turnstileAction = 'turnstile-spin-v1';

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
  const callbackDetail = searchParams?.get('error_description') ?? searchParams?.get('error_code');
  const [fragmentNotice, setFragmentNotice] = useState<string | null>(null);
  const [runtimeConfigured, setRuntimeConfigured] = useState<boolean | null>(null);
  const [authMode, setAuthMode] = useState<string | null>(null);
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [captchaConfigured, setCaptchaConfigured] = useState(false);
  const [captchaSiteKey, setCaptchaSiteKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [captchaNotice, setCaptchaNotice] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsNotice, setTermsNotice] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const nextPath = searchParams?.get('next') ?? authLinks.defaultNext;
  const turnstileSiteKey = captchaSiteKey;
  const turnstileReady = captchaEnabled && captchaConfigured && Boolean(turnstileSiteKey);
  const turnstileNotice = captchaEnabled && !captchaConfigured ? notices['captcha-config'] : null;
  const captchaVisibleNotice = captchaNotice ? notices.captcha : turnstileNotice;

  useEffect(() => {
    void fetch('/api/auth/status')
      .then((response) => response.json())
      .then((payload: AuthStatusPayload) => {
        setRuntimeConfigured(Boolean(payload.configured));
        setAuthMode(payload.mode ?? null);
        setCaptchaEnabled(Boolean(payload.captchaEnabled));
        setCaptchaConfigured(Boolean(payload.captchaConfigured));
        setCaptchaSiteKey(payload.captchaSiteKey?.trim() ?? '');
        setSupabaseUrl(payload.supabaseUrl?.trim() ?? '');
        setSupabaseAnonKey(payload.supabaseAnonKey?.trim() ?? '');
      })
      .catch(() => {
        setRuntimeConfigured(false);
        setAuthMode(null);
        setCaptchaEnabled(false);
        setCaptchaConfigured(false);
        setCaptchaSiteKey('');
        setSupabaseUrl('');
        setSupabaseAnonKey('');
      });
  }, []);

  const browserSupabaseClient = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseAnonKey, supabaseUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const fragment = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    if (!fragment) return;

    const params = new URLSearchParams(fragment);
    const description = params.get('error_description') ?? params.get('error') ?? null;
    setFragmentNotice(description);
  }, []);

  const notice =
    redirectNotice ??
    (fragmentNotice
      ? {
          message: fragmentNotice,
          tone: 'error' as const
        }
      : null) ??
    (termsNotice ? { message: 'Accept the Privacy Policy and Terms of Service to continue.', tone: 'warn' as const } : null) ??
    (captchaVisibleNotice
      ? {
          message: captchaVisibleNotice.message,
          tone: captchaVisibleNotice.tone
        }
      : null) ??
    (runtimeConfigured === false ? notices.config : null);

  const resolvedNotice =
    noticeKey === 'callback' && callbackDetail
      ? {
          message: `${notices.callback.message} (${callbackDetail})`,
          tone: notices.callback.tone
        }
      : notice;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (runtimeConfigured === null) {
      event.preventDefault();
      return;
    }

    if (!agreedToTerms) {
      event.preventDefault();
      setTermsNotice(true);
      return;
    }

    if (authMode === 'local_fixture') {
      return;
    }

    event.preventDefault();
    setIsSigningIn(true);

    if (captchaEnabled) {
      if (!captchaConfigured) {
        setIsSigningIn(false);
        setCaptchaConfigured(false);
        return;
      }

      const formData = new FormData(event.currentTarget);
      const token = formData.get('cf-turnstile-response');
      if (typeof token !== 'string' || !token.trim()) {
        setIsSigningIn(false);
        setCaptchaNotice(true);
        return;
      }

      const verification = await fetch('/api/auth/turnstile', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ turnstileToken: token.trim() })
      });

      if (!verification.ok) {
        setIsSigningIn(false);
        const payload = (await verification.json().catch(() => null)) as
          | { reason?: string }
          | null;
        if (payload?.reason === 'missing-config') {
          setCaptchaNotice(false);
          setCaptchaConfigured(false);
        } else {
          setCaptchaNotice(true);
        }
        return;
      }
    }

    if (!browserSupabaseClient) {
      setIsSigningIn(false);
      return;
    }

    const callbackParams = new URLSearchParams({ next: nextPath, mode });
    const redirectTo = `${window.location.origin}${authLinks.callback}?${callbackParams.toString()}`;
    const { error } = await browserSupabaseClient.auth.signInWithOAuth({
      provider: 'gitlab',
      options: {
        redirectTo,
        scopes: 'read_user'
      }
    });

    if (error) {
      setIsSigningIn(false);
      const failureUrl = new URL(authLinks.login, window.location.origin);
      failureUrl.searchParams.set('next', nextPath);
      failureUrl.searchParams.set('mode', mode);
      failureUrl.searchParams.set('error', 'oauth');
      window.location.assign(failureUrl.toString());
    }
  }

  function resetCaptchaNotice() {
    if (captchaNotice) {
      setCaptchaNotice(false);
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

        {resolvedNotice ? (
          <aside
            className={`landing-auth-notice landing-auth-notice--${resolvedNotice.tone}`}
            data-border="true"
            role="status"
          >
            <p style={body14}>{resolvedNotice.message}</p>
          </aside>
        ) : null}

        <form className="landing-auth-form" action={authProviderHref('gitlab', mode, nextPath)} method="POST" onSubmit={handleSubmit}>
          {turnstileReady ? (
            <div className="landing-auth-captcha">
              <Script
                id={`turnstile-${mode}`}
                src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                strategy="afterInteractive"
                onLoad={resetCaptchaNotice}
              />
              <div
                className="cf-turnstile"
                data-sitekey={turnstileSiteKey}
                data-action={turnstileAction}
                data-theme="light"
              />
            </div>
          ) : null}

          <div className="landing-auth-card__providers">
            <button
              type="submit"
              className="landing-auth-provider landing-auth-provider--gitlab"
              data-border="true"
              aria-disabled={
                runtimeConfigured === null ||
                !agreedToTerms ||
                isSigningIn ||
                (captchaEnabled && !captchaConfigured)
              }
              disabled={runtimeConfigured === null || isSigningIn || (captchaEnabled && !captchaConfigured)}
              onClick={() => setCaptchaNotice(false)}
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
              <span style={{ ...navLink, color: 'rgb(255, 255, 255)' }}>GitHub not enabled</span>
            </button>
          </div>

          <label className="landing-auth-terms landing-auth-terms--plain">
            <input
              type="checkbox"
              className="landing-auth-terms__input"
              aria-label="I agree to the Privacy Policy and Terms of Service."
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
        </form>

        <footer className="landing-auth-card__footer">
          <Link href={alternateHref} className="landing-route-link">
            {alternateLabel}
          </Link>
        </footer>
      </div>
    </div>
  );
}
