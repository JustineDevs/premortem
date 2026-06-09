import type { ButtonHTMLAttributes, ReactNode } from 'react';

type OsIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
};

export function OsIconButton({ children, label, className = '', type = 'button', ...props }: OsIconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center border-0 bg-transparent p-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-800/25 rounded ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
