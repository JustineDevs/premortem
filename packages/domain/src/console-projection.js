import { issueCandidateToConsoleStatus } from './review';
import { runStatusToConsoleRunStatus, scoreFromReviewQueueCounts, scoreFromSeverityCounts } from './status';
import { countSeverities, severityToConsole } from './severity';
export function projectIssueCandidateToConsoleFinding(snapshot, issue) {
    const severity = severityToConsole('high');
    return {
        id: issue.id,
        title: issue.title,
        severity,
        status: issueCandidateToConsoleStatus(issue),
        category: 'issue_candidate',
        filepath: snapshot.branch,
        line: 0,
        description: issue.title,
        evidence: `Validation: ${issue.validationStatus}. Reviewer: ${issue.reviewerStatus}.`,
        trace: snapshot.lineage
            .filter((entry) => entry.stage === 'issue_candidate' && entry.id === issue.id)
            .map((entry, index) => ({
            step: index + 1,
            description: entry.label,
            location: entry.parentId ?? snapshot.auditRunId
        })),
        recommendation: 'Review and approve before publish.',
        aiReasoning: snapshot.findings[0]?.predictedFailureSummary ??
            'Structured issue candidate synthesized from specialist swarm findings.',
        gitlabIssueId: issue.publishedUrl ?? undefined,
        whyItMatters: issue.title
    };
}
export function projectSnapshotToConsoleAudit(snapshot, projectName, createdAt) {
    const severityCounts = countSeverities(snapshot.findings);
    return {
        id: snapshot.auditRunId,
        projectId: snapshot.projectId,
        projectName,
        score: scoreFromSeverityCounts(severityCounts),
        status: runStatusToConsoleRunStatus(snapshot.runStatus),
        date: createdAt ?? new Date().toISOString(),
        criticalCount: severityCounts.critical,
        highCount: severityCounts.high,
        mediumCount: severityCounts.medium,
        lowCount: severityCounts.low,
        findings: snapshot.issueCandidates.map((issue) => projectIssueCandidateToConsoleFinding(snapshot, issue)),
        runtimeEventTypes: snapshot.events.map((event) => event.eventType)
    };
}
export function projectAuditListItemToConsoleAudit(item, projectName) {
    return {
        id: item.auditRunId,
        projectId: item.projectId,
        projectName,
        score: scoreFromReviewQueueCounts(item.reviewableIssueCount, item.rejectedIssueCount),
        status: runStatusToConsoleRunStatus(item.runStatus),
        date: item.createdAt,
        criticalCount: 0,
        highCount: item.reviewableIssueCount,
        mediumCount: item.rejectedIssueCount,
        lowCount: 0,
        findings: []
    };
}
