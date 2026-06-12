import type { DocNavItem } from '@/content/marketing/docs-index';

export type DocCalloutVariant = 'local' | 'production' | 'note' | 'warning';

export type DocCallout = {
  variant: DocCalloutVariant;
  text: string;
};

export type DocCodeBlock = {
  id?: string;
  title?: string;
  language?: string;
  code: string;
};

export type DocScreenshot = {
  src: string;
  alt: string;
  caption?: string;
};

/** Reusable doc page renderer input shape */
export type StructuredDoc = {
  title: string;
  lead: string;
  audience?: string;
  prerequisites?: readonly string[];
  expectedResult?: string;
  toc?: readonly { id: string; label: string }[];
  sections?: readonly {
    id: string;
    heading: string;
    bullets?: readonly string[];
    body?: string;
    externalHref?: string;
    codeBlocks?: readonly DocCodeBlock[];
    callouts?: readonly DocCallout[];
    screenshot?: DocScreenshot;
  }[];
  bullets?: readonly string[];
  codeBlocks?: readonly DocCodeBlock[];
  callouts?: readonly DocCallout[];
  screenshot?: DocScreenshot;
  relatedLinks?: readonly DocNavItem[];
  githubSource?: string;
};
