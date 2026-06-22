'use client';

import { useLayoutEffect, useState, type ReactNode } from 'react';

const DESIGN_WIDTH = 1905;
const DESIGN_HEIGHT = 960;
const RESPONSIVE_BREAKPOINT = 768;

type LayoutMode = 'scaled' | 'responsive';

function getLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') {
    return 'scaled';
  }

  return window.innerWidth < RESPONSIVE_BREAKPOINT ? 'responsive' : 'scaled';
}

function getScale(mode: LayoutMode) {
  if (typeof window === 'undefined' || mode === 'responsive') {
    return 1;
  }

  return Math.min(1, window.innerWidth / DESIGN_WIDTH);
}

export function LandingScale({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<LayoutMode>('scaled');
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const update = () => {
      const nextLayout = getLayoutMode();
      setLayout(nextLayout);
      setScale(getScale(nextLayout));
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isScaled = layout === 'scaled';

  return (
    <div className="landing-scale-host" data-layout={layout}>
      <div
        className="landing-scale-frame"
        style={
          isScaled
            ? {
                width: DESIGN_WIDTH * scale,
                height: DESIGN_HEIGHT * scale
              }
            : undefined
        }
      >
        <div
          className="landing-scale-canvas"
          style={
            isScaled
              ? {
                  width: DESIGN_WIDTH,
                  height: DESIGN_HEIGHT,
                  transform: `scale(${scale})`
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
