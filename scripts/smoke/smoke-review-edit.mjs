/**
 * Smoke edit payloads that exercise the review edit API without replacing
 * synthesized titles with placeholder strings in published GitLab work items.
 */

function readField(candidate, camel, snake) {
  return candidate?.[camel] ?? candidate?.[snake] ?? '';
}

export function smokeReviewEditPayload(candidate) {
  const predicted = readField(candidate, 'predictedFailureSummary', 'predicted_failure_summary');
  const why = readField(candidate, 'whyItMatters', 'why_it_matters');
  const action = readField(candidate, 'recommendedActionSummary', 'recommended_action_summary');

  return {
    whyItMatters: why || predicted || 'Reviewer confirmed finding context before publish.',
    recommendedActionSummary:
      action || 'Apply the listed implementation steps and verify success criteria in CI before merge.'
  };
}
