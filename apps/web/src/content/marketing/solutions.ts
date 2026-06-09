export const solutionsPage = {
  title: 'Solutions',
  description: 'Use Premortem where pre-merge risk discovery, structured findings, and reviewer trust matter.',
  personas: [
    {
      id: 'engineering',
      title: 'Engineering teams',
      outcomes: [
        'Catch cross-cutting risks across code, CI, and config before merge.',
        'Review structured findings with enough context to approve or reject quickly.',
        'Reduce surprise production issues from undetected repo drift.'
      ]
    },
    {
      id: 'platform',
      title: 'Platform & DevOps',
      outcomes: [
        'Audit pipeline definitions, deployment configs, and repository topology together.',
        'Explain why a finding matters using graph-backed workflow context.',
        'Align CI and infrastructure changes with reviewer-visible evidence.'
      ]
    },
    {
      id: 'security',
      title: 'Security & compliance',
      outcomes: [
        'Review synthesized issue candidates with traceable audit runs.',
        'Approve findings before sync to GitLab issue trackers.',
        'Maintain publish and reconciliation paths for auditability.'
      ]
    },
    {
      id: 'ai-delivery',
      title: 'AI-assisted delivery',
      outcomes: [
        'Combine Gemini-powered analysis with deterministic validation gates.',
        'Keep human approval in the loop before automated output ships.',
        'Avoid raw model dumps. Outputs stay review-ready and structured.'
      ]
    }
  ],
  workflowSummary:
    'Audit → Review → Publish: connect GitLab, run a multi-lens premortem, approve structured findings, then sync issues with reconciliation.'
} as const;
