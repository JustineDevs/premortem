'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

type LogoHomeButtonProps = {
  children: ReactNode;
};

export function LogoHomeButton({ children }: LogoHomeButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (window.location.pathname === '/') {
      window.location.reload();
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      className="landing-logo-home framer-ikdl1u"
      onClick={handleClick}
      aria-label="Go to home and refresh"
    >
      {children}
    </button>
  );
}
