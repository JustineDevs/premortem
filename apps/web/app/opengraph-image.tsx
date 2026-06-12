import { ImageResponse } from 'next/og';

export const size = {
  width: 1200,
  height: 630
};

export const contentType = 'image/png';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://premortem.jstn.site';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background:
            'linear-gradient(135deg, rgb(251, 251, 248) 0%, rgb(239, 243, 255) 54%, rgb(226, 232, 240) 100%)',
          color: 'rgb(18, 18, 18)',
          fontFamily: 'Inter, Arial, sans-serif'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgb(18, 18, 18)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 700
            }}
          >
            P
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.04em' }}>Premortem</div>
            <div style={{ fontSize: '14px', color: 'rgb(75, 85, 99)' }}>{siteUrl}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px' }}>
          <div
            style={{
              fontSize: '72px',
              fontWeight: 600,
              lineHeight: 1.02,
              letterSpacing: '-0.06em'
            }}
          >
            Run on your repo before it breaks production.
          </div>
          <div
            style={{
              fontSize: '28px',
              lineHeight: 1.35,
              color: 'rgb(55, 65, 81)',
              maxWidth: '780px'
            }}
          >
            GitLab-first audits, review-ready findings, and operational guardrails for the launch
            path.
          </div>
        </div>
      </div>
    ),
    size
  );
}
