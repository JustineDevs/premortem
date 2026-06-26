import type { CSSProperties } from 'react';

import { assets } from './assets';
import { workflowBody, workflowTitle } from './text-styles';

const workflowPanelStyle = {
  ['--border-bottom-width' as string]: '1px',
  ['--border-color' as string]: 'rgba(34, 34, 34, 0.15)',
  ['--border-left-width' as string]: '1px',
  ['--border-right-width' as string]: '1px',
  ['--border-style' as string]: 'solid',
  ['--border-top-width' as string]: '1px',
  backgroundColor: 'rgb(245, 244, 239)'
} as unknown as CSSProperties;

const workflowPreviewStyle = {
  border: 0,
  borderBottomLeftRadius: 10,
  borderBottomRightRadius: 10,
  boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.25)',
  backgroundColor: 'rgb(0, 0, 0)'
} as unknown as CSSProperties;

export function WorkflowPanel() {
  return (
    <div
      className="framer-1w15ql"
      data-border="true"
      style={workflowPanelStyle}
    >
      <p className="framer-1nryg1i" style={workflowTitle}>
        Built for modern agentic workflows
      </p>
      <p className="framer-kkwewm" style={workflowBody}>
        Deploy AI agents in your dev workflows and control every issue they create.
      </p>
      <img
        src={assets.workflowHeader}
        alt="Premortem"
        width={219}
        height={73}
        className="framer-14nxad0"
        style={{ objectFit: 'contain' }}
      />
      <iframe
        src="https://www.youtube-nocookie.com/embed/Nf_SvtWH_vo?rel=0&modestbranding=1&playsinline=1"
        title="Premortem dashboard preview video"
        width={837}
        height={368}
        className="framer-qv74g5"
        style={workflowPreviewStyle}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
