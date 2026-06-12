import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

import { OsEmptyState } from '@/components/premortem-os/os-empty-state';
import { marketingLinks } from '@/lib/marketing-links';
import { premortemBrand } from '@/lib/premortem-os/branding';

const quickRoutes = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app?tab=projects', label: 'Projects' },
  { href: '/app?tab=audits', label: 'Audits' },
  { href: '/docs', label: 'Docs' }
] as const;

export const metadata = {
  title: `Route not found | ${premortemBrand.productName}`,
  description: 'The reviewer console route was not recognized.'
};

export default function OsNotFoundPage() {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-[#fbfbfa] p-6">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <OsEmptyState
          icon={FileQuestion}
          title="Console route not found"
          description="This reviewer console path does not exist. Jump back to a real workspace surface or open the docs for the route map."
          className="w-full"
          action={
            <div className="flex flex-wrap justify-center gap-3">
              {quickRoutes.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className="inline-flex min-h-11 items-center justify-center border border-[#e4e2dc] bg-white px-4 text-sm font-medium text-[#1e2522] transition-colors hover:bg-[#f5f4ef]"
                >
                  {route.label}
                </Link>
              ))}
            </div>
          }
        />

        <aside className="border border-[#e4e2dc] bg-[#faf8f5] p-5 text-left">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#5c6560]">
            Route map
          </p>
          <ul className="mt-3 space-y-3 text-sm text-[#1e2522]">
            <li>Dashboard for workspace overview and runtime control.</li>
            <li>Projects for repo connect, provider setup, and audit scope.</li>
            <li>Audits for history, review, and publish actions.</li>
            <li>Docs for setup, troubleshooting, and exact references.</li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-[#5c6560]">
            Need help getting back to a signed-in console? Use{' '}
            <Link href={marketingLinks.login} className="underline underline-offset-2">
              login
            </Link>{' '}
            or contact support from the product footer.
          </p>
        </aside>
      </div>
    </div>
  );
}
