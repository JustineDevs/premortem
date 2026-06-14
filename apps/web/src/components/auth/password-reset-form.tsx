'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

import { authLinks } from '@/lib/auth-links';
import { marketingLinks } from '@/lib/marketing-links';

import { body14, label14, navLink, sectionTitle } from '../landing/text-styles';

type PasswordResetFormProps = {
  mode: 'request' | 'reset';
  title: string;
  description: string;
  alternateHref: string;
  alternateLabel: string;
};

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}

export function PasswordResetForm({
  mode,
  title,
  description,
  alternateHref,
  alternateLabel
}: PasswordResetFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'warn' | 'error' | 'success'>('warn');

  const isRequestMode = mode === 'request';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    try {
      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error('Supabase auth is not configured.');
      }

      if (isRequestMode) {
        const redirectTo = new URL(authLinks.resetPassword, window.location.origin);
        redirectTo.pathname = authLinks.callback;
        redirectTo.searchParams.set('next', authLinks.resetPassword);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo.toString()
        });

        if (error) {
          throw error;
        }

        setNoticeTone('success');
        setNotice('If the address exists, we sent a password reset link.');
        setEmail('');
        return;
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setNoticeTone('success');
      setNotice('Password updated. Redirecting to your workspace.');
      router.replace(authLinks.defaultNext);
    } catch (error) {
      setNoticeTone('error');
      setNotice(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
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
            className={`landing-auth-notice landing-auth-notice--${noticeTone}`}
            data-border="true"
            role="status"
          >
            <p style={body14}>{notice}</p>
          </aside>
        ) : null}

        <form className="landing-auth-form" onSubmit={handleSubmit}>
          <label className="landing-auth-field">
            <span className="landing-auth-field__label" style={label14}>
              {isRequestMode ? 'Email address' : 'New password'}
            </span>
            {isRequestMode ? (
              <input
                type="email"
                name="email"
                autoComplete="email"
                className="landing-auth-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            ) : (
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                className="landing-auth-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            )}
          </label>

          {!isRequestMode ? (
            <label className="landing-auth-field">
              <span className="landing-auth-field__label" style={label14}>
                Confirm new password
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

          <button type="submit" className="landing-auth-submit" disabled={busy} data-border="true">
            <span style={{ ...navLink, color: 'rgb(255, 255, 255)' }}>
              {busy ? 'Please wait' : isRequestMode ? 'Send reset link' : 'Update password'}
            </span>
          </button>
        </form>

        <footer className="landing-auth-card__footer">
          <div className="landing-auth-card__footer-links">
            <Link href={marketingLinks.docsGuidesAuthSessions} className="landing-route-link">
              Need help signing in?
            </Link>
            <Link href={alternateHref} className="landing-route-link">
              {alternateLabel}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
