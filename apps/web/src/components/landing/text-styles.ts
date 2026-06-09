import type { CSSProperties } from 'react';

export const inter: CSSProperties = { fontFamily: 'var(--font-inter), Inter, sans-serif' };
export const geist: CSSProperties = { fontFamily: 'var(--font-geist-sans), Geist, sans-serif' };

export const heroTitle: CSSProperties = {
  ...inter,
  fontSize: 33,
  fontWeight: 400,
  letterSpacing: '-2.16px',
  lineHeight: '52.8px',
  margin: 0
};

export const sectionTitle: CSSProperties = {
  ...inter,
  fontSize: 26,
  fontWeight: 400,
  letterSpacing: '-2.16px',
  lineHeight: '52.8px',
  margin: 0
};

export const body14: CSSProperties = {
  ...inter,
  fontSize: 14,
  letterSpacing: '-0.28px',
  lineHeight: '21px',
  margin: 0
};

export const label14: CSSProperties = {
  ...inter,
  fontSize: 14,
  letterSpacing: '-0.27px',
  lineHeight: '18.631184460597px',
  margin: 0
};

export const mono12: CSSProperties = {
  ...inter,
  fontSize: 12,
  letterSpacing: '-0.12px',
  lineHeight: '18px',
  margin: 0,
  whiteSpace: 'pre-wrap'
};

export const learnMore: CSSProperties = {
  ...geist,
  fontSize: 9.6,
  fontWeight: 600,
  lineHeight: '14.4px',
  color: 'rgb(40, 37, 232)',
  textDecoration: 'underline',
  margin: 0
};

export const navLink: CSSProperties = {
  ...inter,
  fontWeight: 500,
  letterSpacing: '0.16px',
  lineHeight: '24px',
  margin: 0
};

export const workflowTitle: CSSProperties = {
  ...inter,
  fontSize: 35,
  fontWeight: 500,
  lineHeight: '54.64615384615388px',
  margin: 0
};

export const workflowBody: CSSProperties = {
  ...inter,
  fontSize: 24,
  letterSpacing: '-0.27px',
  lineHeight: '40.98461538461538px',
  margin: 0
};

export const aiAgentLabel: CSSProperties = {
  ...inter,
  fontSize: 12,
  letterSpacing: '1.8px',
  lineHeight: '18px',
  color: 'rgb(79, 79, 79)',
  textTransform: 'uppercase',
  margin: 0
};

export const announcementText: CSSProperties = {
  ...geist,
  fontSize: 9.6,
  fontWeight: 500,
  lineHeight: '14.4px',
  color: 'rgb(254, 182, 39)',
  margin: 0
};

export const announcementLink: CSSProperties = {
  ...geist,
  fontSize: 9.6,
  fontWeight: 600,
  lineHeight: '14.4px',
  color: 'rgb(254, 182, 39)',
  textDecoration: 'underline',
  margin: 0
};

export const utilityLink: CSSProperties = {
  ...geist,
  fontSize: 14,
  color: 'rgb(42, 42, 42)',
  margin: 0
};
