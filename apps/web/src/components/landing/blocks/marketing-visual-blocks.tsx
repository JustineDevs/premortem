import Link from 'next/link';

import { premortemSteps } from '@/content/marketing/shared';

import { body14, label14, mono12 } from '../text-styles';

export function MarketingStepGrid() {
  return (
    <div className="landing-block-step-grid" aria-label="How Premortem works">
      {premortemSteps.map((step) => (
        <div key={step.id} className="landing-block-step-grid__col">
          <p style={mono12}>{step.title}</p>
          {step.lines.map((line) => (
            <p key={line} style={mono12}>
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

type MarketingScreenshotProps = {
  src: string;
  alt: string;
  caption?: string;
  crop?: 'preview' | 'console';
  showCaption?: boolean;
};

export function MarketingScreenshot({
  src,
  alt,
  caption,
  crop,
  showCaption = true
}: MarketingScreenshotProps) {
  const imgClass =
    crop === 'preview'
      ? 'landing-block-screenshot__img landing-block-screenshot__img--preview'
      : crop === 'console'
        ? 'landing-block-screenshot__img landing-block-screenshot__img--console'
        : 'landing-block-screenshot__img';

  return (
    <figure className="landing-block-screenshot">
      <img src={src} alt={alt} width={778} height={417} className={imgClass} />
      {showCaption && caption ? (
        <figcaption className="landing-block-screenshot__caption" style={body14}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

type MarketingProductMapProps = {
  tiles: readonly { title: string; description: string; href: string }[];
};

export function MarketingProductMap({ tiles }: MarketingProductMapProps) {
  return (
    <div className="landing-block-product-map">
      {tiles.map((tile) => (
        <Link key={tile.title} href={tile.href} className="landing-block-product-map__tile" data-border="true">
          <h3 className="landing-block-product-map__title" style={label14}>
            {tile.title}
          </h3>
          <p className="landing-block-product-map__body" style={body14}>
            {tile.description}
          </p>
        </Link>
      ))}
    </div>
  );
}
