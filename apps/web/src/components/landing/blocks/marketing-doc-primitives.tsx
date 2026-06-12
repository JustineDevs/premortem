'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { DocCallout, DocCalloutVariant, DocCodeBlock, DocScreenshot } from '@/content/marketing/docs-types';
import { docsNavSections } from '@/content/marketing/docs-index';

import { body14, label14, mono12 } from '../text-styles';

const CALLOUT_LABEL: Record<DocCalloutVariant, string> = {
  local: 'Local dev',
  production: 'Production',
  note: 'Note',
  warning: 'Warning'
};

export function MarketingDocCallout({ variant, text }: DocCallout) {
  return (
    <div className={`landing-doc-callout landing-doc-callout--${variant}`} role="note">
      <span className="landing-doc-callout__label" style={mono12}>
        {CALLOUT_LABEL[variant]}
      </span>
      <p style={body14}>{text}</p>
    </div>
  );
}

export function MarketingDocCodeBlock({ title, language = 'bash', code }: DocCodeBlock) {
  return (
    <figure className="landing-doc-code">
      {title ? (
        <figcaption className="landing-doc-code__title" style={mono12}>
          {title}
        </figcaption>
      ) : null}
      <pre className="landing-doc-code__pre">
        <code className={`landing-doc-code__code language-${language}`}>{code}</code>
      </pre>
    </figure>
  );
}

export function MarketingDocScreenshot({ src, alt, caption }: DocScreenshot) {
  return (
    <figure className="landing-doc-screenshot">
      <div className="landing-doc-screenshot__frame">
        <img src={src} alt={alt} className="landing-doc-screenshot__img" loading="lazy" decoding="async" />
      </div>
      {caption ? (
        <figcaption className="landing-doc-screenshot__caption" style={body14}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function MarketingDocGithubSource({ href }: { href: string }) {
  return (
    <p className="landing-doc-github-source">
      <a href={href} className="landing-doc-github-source__link" target="_blank" rel="noopener noreferrer">
        View source on GitHub
      </a>
    </p>
  );
}

type NavHit = {
  href: string;
  label: string;
  description?: string;
  section: string;
};

export function MarketingDocSearch() {
  const [query, setQuery] = useState('');

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const items: NavHit[] = [];
    for (const section of docsNavSections) {
      for (const item of section.items) {
        const haystack = `${item.label} ${item.description ?? ''} ${section.title}`.toLowerCase();
        if (haystack.includes(q)) {
          items.push({
            href: item.href,
            label: item.label,
            description: item.description,
            section: section.title
          });
        }
      }
    }
    return items.slice(0, 8);
  }, [query]);

  return (
    <div className="landing-doc-search">
      <label htmlFor="landing-doc-search-input" className="landing-doc-search__label" style={mono12}>
        Search docs
      </label>
      <input
        id="landing-doc-search-input"
        type="search"
        className="landing-doc-search__input"
        placeholder="Connect GitLab, deploy, billing…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      {query.trim() && hits.length > 0 ? (
        <ul className="landing-doc-search__results" role="listbox">
          {hits.map((hit) => (
            <li key={hit.href}>
              <Link href={hit.href} className="landing-doc-search__hit" scroll={false}>
                <span className="landing-doc-search__hit-label" style={label14}>
                  {hit.label}
                </span>
                <span className="landing-doc-search__hit-meta" style={mono12}>
                  {hit.section}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {query.trim() && hits.length === 0 ? (
        <p className="landing-doc-search__empty" style={body14}>
          No matching docs. Try &quot;billing&quot;, &quot;deploy&quot;, or &quot;canvas&quot;.
        </p>
      ) : null}
    </div>
  );
}
