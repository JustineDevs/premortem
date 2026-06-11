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
    PUBLISH: 'publish'
};
/** Console reviewer gestures in `/app`. */
export const ConsoleReviewAction = {
    CONFIRM: 'CONFIRMED',
    DISMISS: 'DISMISSED',
    RESOLVE: 'RESOLVED',
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
        case ConsoleReviewAction.PUBLISH:
            return ReviewAction.PUBLISH;
        default: {
            const exhaustive = action;
            throw new Error(`Unsupported console review action: ${exhaustive}`);
        }
    }
}
export function consoleReviewActionNotes(action) {
    if (action === ConsoleReviewAction.RESOLVE) {
        return 'Marked resolved by reviewer';
    }
    return undefined;
}
export function consoleStatusAfterReviewAction(action) {
    switch (action) {
        case ConsoleReviewAction.CONFIRM:
        case ConsoleReviewAction.RESOLVE:
            return ConsoleIssueStatus.CONFIRMED;
        case ConsoleReviewAction.DISMISS:
            return ConsoleIssueStatus.DISMISSED;
        case ConsoleReviewAction.PUBLISH:
            return ConsoleIssueStatus.PUBLISHED;
        default:
            return undefined;
    }
}
