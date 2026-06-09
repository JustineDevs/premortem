import { assets } from './assets';
import { workflowBody, workflowTitle } from './text-styles';

export function WorkflowPanel() {
  return (
    <div
      className="framer-1w15ql"
      data-border="true"
      style={{
        ['--border-bottom-width' as string]: '1px',
        ['--border-color' as string]: 'rgba(34, 34, 34, 0.15)',
        ['--border-left-width' as string]: '1px',
        ['--border-right-width' as string]: '1px',
        ['--border-style' as string]: 'solid',
        ['--border-top-width' as string]: '1px',
        backgroundColor: 'rgb(245, 244, 239)'
      }}
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
      <img
        src={assets.workflowPreview}
        alt="Premortem dashboard preview"
        width={837}
        height={368}
        className="framer-qv74g5"
        style={{
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
          boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.25)',
          objectFit: 'cover'
        }}
      />
    </div>
  );
}
