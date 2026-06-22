/** Persisted reviewer states: mirrors Prisma `ReviewStatus`. */
export const ReviewStatus = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    EDITED: 'edited'
};
/** API / DB review verbs: mirrors Prisma `ReviewActionType` subset used by runtime. */
export const ReviewAction = {
    APPROVE: 'approve',
    REJECT: 'reject',
    EDIT: 'edit',
    MERGE: 'merge',
    SPLIT: 'split',
    PUBLISH: 'publish'
};
/** Console reviewer gestures in `/app`. */
export const ConsoleReviewAction = {
    CONFIRM: 'CONFIRMED',
    DISMISS: 'DISMISSED',
    RESOLVE: 'RESOLVED',
    MERGE: 'MERGED',
    SPLIT: 'SPLIT',
    DEFER: 'DEFERRED',
    PUBLISH: 'PUBLISH'
};
/** Console issue row status derived from runtime issue candidates. */
export const ConsoleIssueStatus = {
    OPEN: 'OPEN',
    CONFIRMED: 'CONFIRMED',
    DISMISSED: 'DISMISSED',
    RESOLVED: 'RESOLVED',
    PUBLISHED: 'PUBLISHED'
};
export function issueCandidateToConsoleStatus(input) {
    if (input.publishedUrl) {
        return ConsoleIssueStatus.PUBLISHED;
    }
    if (input.reviewerStatus === ReviewStatus.APPROVED ||
        input.reviewerStatus === ReviewStatus.EDITED) {
        return ConsoleIssueStatus.CONFIRMED;
    }
    if (input.reviewerStatus === ReviewStatus.REJECTED) {
        return ConsoleIssueStatus.DISMISSED;
    }
    return ConsoleIssueStatus.OPEN;
}
export function consoleReviewActionToReviewAction(action) {
    switch (action) {
        case ConsoleReviewAction.CONFIRM:
        case ConsoleReviewAction.RESOLVE:
            return ReviewAction.APPROVE;
        case ConsoleReviewAction.DISMISS:
            return ReviewAction.REJECT;
        case ConsoleReviewAction.MERGE:
            return ReviewAction.MERGE;
        case ConsoleReviewAction.SPLIT:
            return ReviewAction.SPLIT;
        case ConsoleReviewAction.DEFER:
            return ReviewAction.EDIT;
        case ConsoleReviewAction.PUBLISH:
            return ReviewAction.PUBLISH;
        default: {
            const exhaustive = action;
            throw new Error(`Unsupported console review action: ${exhaustive}`);
        }
    }
}
export function isReviewerStatusApprovedForPublish(reviewerStatus) {
    return (reviewerStatus === ReviewStatus.APPROVED || reviewerStatus === ReviewStatus.EDITED);
}
export function consoleReviewActionNotes(action) {
    if (action === ConsoleReviewAction.RESOLVE) {
        return 'Marked resolved by reviewer';
    }
    if (action === ConsoleReviewAction.DEFER) {
        return 'Deferred for later review';
    }
    return undefined;
}
export function consoleReviewActionPayload(action, extra) {
    if (action === ConsoleReviewAction.DEFER) {
        return { deferred: true, ...extra };
    }
    return extra;
}
export function consoleStatusAfterReviewAction(action) {
    switch (action) {
        case ConsoleReviewAction.CONFIRM:
        case ConsoleReviewAction.RESOLVE:
            return ConsoleIssueStatus.CONFIRMED;
        case ConsoleReviewAction.DISMISS:
            return ConsoleIssueStatus.DISMISSED;
        case ConsoleReviewAction.MERGE:
            return ConsoleIssueStatus.DISMISSED;
        case ConsoleReviewAction.DEFER:
            return ConsoleIssueStatus.OPEN;
        case ConsoleReviewAction.PUBLISH:
            return ConsoleIssueStatus.PUBLISHED;
        default:
            return undefined;
    }
}
