import { assets } from './assets';
import { body14, learnMore } from './text-styles';

const ecosystemLinks = {
  googleCloud: 'https://ai.google.dev/',
  gemini: 'https://ai.google.dev/gemini-api/docs',
  gitlab: 'https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/',
  github: 'https://docs.github.com/en'
} as const;

function cardBorder() {
  return {
    ['--border-bottom-width' as string]: '0px',
    ['--border-color' as string]: 'rgba(34, 34, 34, 0.23)',
    ['--border-left-width' as string]: '0px',
    ['--border-right-width' as string]: '1px',
    ['--border-style' as string]: 'solid',
    ['--border-top-width' as string]: '0px'
  };
}

export function EcosystemSection() {
  return (
    <div className="framer-17au5z4">
      <div
        className="framer-wwhla landing-ecosystem-card"
        data-border="true"
        style={cardBorder()}
      >
        <img
          src={assets.googleCloud}
          alt="Google Cloud"
          width={137}
          height={23}
          className="framer-bt8yzt landing-ecosystem-logo"
          style={{ objectFit: 'contain' }}
        />
        <p className="framer-1miso45 landing-ecosystem-body" style={body14}>
          Gemini models and orchestrator swarm execution for multi-lens repository audits.
        </p>
        <a
          className="framer-1tay0ew landing-ecosystem-link"
          style={learnMore}
          href={ecosystemLinks.googleCloud}
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more
        </a>
      </div>

      <div
        className="framer-w7mw7a landing-ecosystem-card"
        data-border="true"
        style={cardBorder()}
      >
        <div className="landing-ecosystem-logo-row">
          <img
            src={assets.geminiIcon}
            alt=""
            width={26}
            height={26}
            className="framer-1gcyl4"
            style={{ objectFit: 'contain' }}
            aria-hidden
          />
          <img
            src={assets.geminiWordmark}
            alt="Gemini"
            width={95}
            height={23}
            className="framer-mh2z42 landing-ecosystem-logo"
            style={{ objectFit: 'contain' }}
          />
        </div>
        <p className="framer-1gbqmus landing-ecosystem-body" style={body14}>
          LLM powering risk analysis, issue synthesis, and structured output generation.
        </p>
        <a
          className="framer-1wrx7x landing-ecosystem-link"
          style={learnMore}
          href={ecosystemLinks.gemini}
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more
        </a>
      </div>

      <div
        className="framer-1fmumkc landing-ecosystem-card"
        data-border="true"
        style={cardBorder()}
      >
        <img
          src={assets.gitlab}
          alt="GitLab"
          width={104}
          height={23}
          className="framer-1jwxt3 landing-ecosystem-logo"
          style={{ objectFit: 'contain' }}
        />
        <p className="framer-1tdhoc0 landing-ecosystem-body" style={body14}>
          Repository context, CI pipeline data, and structured issue creation via MCP and API.
        </p>
        <a
          className="framer-kr8exr landing-ecosystem-link"
          style={learnMore}
          href={ecosystemLinks.gitlab}
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more
        </a>
      </div>

      <div
        className="framer-1a163rr landing-ecosystem-card"
        data-border="true"
        style={cardBorder()}
      >
        <img
          src={assets.github}
          alt="GitHub"
          width={107}
          height={24}
          className="framer-1cn9ozs landing-ecosystem-logo"
          style={{ objectFit: 'contain' }}
        />
        <p className="framer-1whxnzw landing-ecosystem-body" style={body14}>
          GitHub sign-in and publishing are available when configured.
        </p>
        <a
          className="framer-uxkj40 landing-ecosystem-link"
          style={learnMore}
          href={ecosystemLinks.github}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </div>
  );
}
