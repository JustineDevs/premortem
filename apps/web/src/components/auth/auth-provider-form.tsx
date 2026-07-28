'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Image from 'next/image';

import { authLinks, authProviderHref, type AuthMode } from '@/lib/auth-links';
import { type AuthProviderBootstrap } from '@/lib/auth/auth-provider-bootstrap';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
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
  initialBootstrap: AuthProviderBootstrap;
};

type AuthProviderUiState = {
  agreedToTerms: boolean;
  termsNotice: boolean;
  isSigningIn: boolean;
};

type NoticeTone = 'warn' | 'error' | 'success';

const notices: Record<string, { message: string; tone: NoticeTone }> = {
  config: {
    message:
      'Supabase sign-in is not available in this environment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or the SUPABASE_URL and SUPABASE_ANON_KEY fallback pair, then restart.',
    tone: 'error'
  },
  oauth: {
    message:
      'Could not start social sign-in. Check your Supabase provider settings and the configured OAuth scopes.',
    tone: 'error'
  },
  coming_soon: {
    message: 'GitHub sign-in is on the roadmap.',
    tone: 'warn'
  },
  callback: {
    message:
      'Supabase sign-in could not be completed. The external code exchange failed or the callback host did not match the configured origin. Try again from the same browser session.',
    tone: 'error'
  },
  terms: {
    message: 'Accept the Privacy Policy and Terms of Service to continue.',
    tone: 'warn'
  },
  'email-magic-link-sent': {
    message: 'Magic link sent. Check your email to continue.',
    tone: 'success'
  },
  'email-password-success': {
    message: 'Email sign-in succeeded. Redirecting to your workspace.',
    tone: 'success'
  },
  'email-confirmation-sent': {
    message: 'Account created. Check your email to confirm and finish signing in.',
    tone: 'success'
  }
};

function readFragmentNotice(): string | null {
  if (typeof window === 'undefined') return null;

  const fragment = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  if (!fragment) return null;

  const params = new URLSearchParams(fragment);
  return params.get('error_description') ?? params.get('error') ?? null;
}

function getEmailRedirectUrl(nextPath: string, mode: AuthMode) {
  const url = new URL(authLinks.callback, window.location.origin);
  url.searchParams.set('next', nextPath);
  url.searchParams.set('mode', mode);
  return url.toString();
}

export function AuthProviderForm({
  mode,
  title,
  description,
  alternateHref,
  alternateLabel,
  initialBootstrap
}: AuthProviderFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const noticeKey = searchParams?.get('notice') ?? searchParams?.get('error');
  const redirectNotice = noticeKey ? notices[noticeKey] : null;
  const callbackDetail = searchParams?.get('error_description') ?? searchParams?.get('error_code');
  const [fragmentNotice] = useState(readFragmentNotice);
  const localFixtureMode = initialBootstrap.mode === 'local_fixture';
  const [uiState, setUiState] = useState<AuthProviderUiState>({
    agreedToTerms: false,
    termsNotice: false,
    isSigningIn: false
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<{ message: string; tone: NoticeTone } | null>(
    null
  );
  const githubEnabled = false;
  const nextPath = searchParams?.get('next') ?? authLinks.defaultNext;
  const supabase = localFixtureMode
    ? null
    : createSupabaseBrowserClient({
        url: initialBootstrap.supabaseUrl,
        anonKey: initialBootstrap.supabaseAnonKey
      });

  const notice =
    redirectNotice ??
    (fragmentNotice
      ? {
          message: fragmentNotice,
          tone: 'error' as const
        }
      : null) ??
    (uiState.termsNotice
      ? {
          message: 'Accept the Privacy Policy and Terms of Service to continue.',
          tone: 'warn' as const
        }
      : null) ??
    authNotice ??
    null;

  const resolvedNotice =
    noticeKey === 'callback' && callbackDetail
      ? {
          message: `${notices.callback.message} (${callbackDetail})`,
          tone: notices.callback.tone
        }
      : notice;

  function requireTermsIfNeeded() {
    if (!uiState.agreedToTerms) {
      setUiState((current) => ({ ...current, termsNotice: true }));
      return false;
    }
    return true;
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthNotice(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setAuthNotice({ message: 'Passwords do not match.', tone: 'error' });
      return;
    }

    if (!requireTermsIfNeeded()) {
      return;
    }

    if (!supabase) {
      router.replace(nextPath);
      return;
    }

    setEmailBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: getEmailRedirectUrl(nextPath, mode)
          }
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          router.replace(nextPath);
          return;
        }

        setAuthNotice(notices['email-confirmation-sent']);
        setPassword('');
        setConfirmPassword('');
        setEmail('');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        throw error;
      }

      setAuthNotice(notices['email-password-success']);
      router.replace(nextPath);
    } catch (error) {
      setAuthNotice({
        message: error instanceof Error ? error.message : 'Unable to sign in with email.',
        tone: 'error'
      });
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleMagicLinkClick() {
    setAuthNotice(null);

    if (!requireTermsIfNeeded()) {
      return;
    }

    if (!supabase) {
      router.replace(nextPath);
      return;
    }

    setEmailBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: getEmailRedirectUrl(nextPath, mode)
        }
      });

      if (error) {
        throw error;
      }

      setAuthNotice(notices['email-magic-link-sent']);
    } catch (error) {
      setAuthNotice({
        message: error instanceof Error ? error.message : 'Unable to send a magic link.',
        tone: 'error'
      });
    } finally {
      setEmailBusy(false);
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

        <section className="landing-auth-section" aria-label="Provider sign-in">
          <form className="landing-auth-form">
            <input
              type="hidden"
              name="termsAccepted"
              value={uiState.agreedToTerms ? '1' : '0'}
            />
            <div className="landing-auth-card__providers">
              <button
                type="submit"
                formMethod="post"
                formAction={authProviderHref('gitlab', mode, nextPath)}
                className="landing-auth-provider landing-auth-provider--gitlab"
                data-border="true"
                aria-disabled={uiState.isSigningIn || !uiState.agreedToTerms}
                disabled={uiState.isSigningIn || !uiState.agreedToTerms}
              >
                <GitLabLogo />
                <span style={{ ...navLink, color: 'rgb(255, 255, 255)' }}>
                  {uiState.isSigningIn ? 'Redirecting' : 'Continue with GitLab'}
                </span>
              </button>

              <button
                type="button"
                className="landing-auth-provider landing-auth-provider--github"
                data-border="true"
                aria-disabled={uiState.isSigningIn || !uiState.agreedToTerms || !githubEnabled}
                disabled={uiState.isSigningIn || !uiState.agreedToTerms || !githubEnabled}
                title={githubEnabled ? undefined : 'GitHub repository integration is roadmap.'}
                style={githubEnabled ? undefined : { opacity: 1 }}
              >
                <Image
                  src={assets.githubIcon}
                  alt=""
                  width={19}
                  height={19}
                  aria-hidden
                  className="landing-auth-provider__github-icon"
                />
                <span style={{ ...navLink, color: 'rgb(255, 255, 255)' }}>
                  {uiState.isSigningIn ? 'Redirecting' : 'Continue with GitHub'}
                </span>
              </button>

            </div>

          </form>
        </section>

        <div className="landing-auth-divider" aria-hidden="true">
          <span>Or use email</span>
        </div>

        <section className="landing-auth-section" aria-label="Email sign-in">
          <form className="landing-auth-form" onSubmit={handlePasswordSubmit}>
            <div className="landing-auth-fields">
              <label className="landing-auth-field">
                <span className="landing-auth-field__label" style={body14}>
                  Email address
                </span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="landing-auth-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label className="landing-auth-field">
                <span className="landing-auth-field__label" style={body14}>
                  Password
                </span>
                <input
                  type="password"
                  name="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="landing-auth-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </label>

              {mode === 'signup' ? (
                <label className="landing-auth-field">
                  <span className="landing-auth-field__label" style={body14}>
                    Confirm password
                  </span>
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    className="landing-auth-input"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </label>
              ) : null}
            </div>

            <div className="landing-auth-actions">
              <button
                type="submit"
                className="landing-auth-submit"
                disabled={emailBusy || !uiState.agreedToTerms}
                data-border="true"
              >
                <span style={{ ...navLink, color: 'rgb(255, 255, 255)' }}>
                  {emailBusy
                    ? 'Please wait'
                    : mode === 'signup'
                      ? 'Create password account'
                      : 'Sign in with password'}
                </span>
              </button>

              <button
                type="button"
                className="landing-auth-submit landing-auth-submit--secondary"
                disabled={emailBusy || !uiState.agreedToTerms}
                data-border="true"
                onClick={() => {
                  void handleMagicLinkClick();
                }}
              >
                <span style={{ ...navLink, color: 'rgb(17, 17, 17)' }}>
                  {emailBusy ? 'Please wait' : 'Send magic link'}
                </span>
              </button>
            </div>
          </form>
        </section>

        <label className="landing-auth-terms landing-auth-terms--plain">
          <input
            type="checkbox"
            className="landing-auth-terms__input"
            aria-label="I agree to the Privacy Policy and Terms of Service."
            checked={uiState.agreedToTerms}
            onChange={(event) => {
              setUiState((current) => ({
                ...current,
                agreedToTerms: event.target.checked
              }));
              if (event.target.checked) {
                setUiState((current) => ({ ...current, termsNotice: false }));
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

        <footer className="landing-auth-card__footer">
          <Link href={alternateHref} className="landing-route-link">
            {alternateLabel}
          </Link>
        </footer>
      </div>
    </div>
  );
}
