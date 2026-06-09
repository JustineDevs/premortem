'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { authLinks } from '@/lib/auth-links';

import { navLink } from './text-styles';

export function StartBuildingButton() {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const closeTimerRef = useRef<number | null>(null);

  const openMenu = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div
      ref={shellRef}
      className="landing-start-building-shell"
      onMouseEnter={openMenu}
      onMouseLeave={closeMenu}
      onFocus={openMenu}
      onBlur={(event) => {
        if (!shellRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="landing-start-building__trigger"
        style={{ ...navLink, textAlign: 'center' }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <span className="landing-start-building__label">Start building</span>
        <svg
          className="landing-start-building__chevron"
          viewBox="0 0 30 30"
          fill="currentColor"
          aria-hidden
        >
          <path d="M5 13V9h4v4H5Zm4 4v-4h4v4H9Zm4 4v-4h4v4h-4Zm4-4v-4h4v4h-4Zm4-4V9h4v4h-4Z" />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          className="landing-start-building__menu"
          role="menu"
          onMouseEnter={openMenu}
          onMouseLeave={closeMenu}
        >
          <a className="landing-start-building__menu-item" role="menuitem" href={authLinks.signup}>
            Sign up
          </a>
          <a className="landing-start-building__menu-item" role="menuitem" href={authLinks.login}>
            Log in
          </a>
        </div>
      ) : null}
    </div>
  );
}
