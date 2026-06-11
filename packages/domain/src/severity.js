/** Persisted severity: mirrors Prisma `SeverityLevel`. */
export const SeverityLevel = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};
/** Console severity labels (uppercase display). */
export const ConsoleSeverity = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};
export function severityToConsole(severity) {
    const normalized = severity.toLowerCase();
    if (normalized === SeverityLevel.CRITICAL)
        return ConsoleSeverity.CRITICAL;
    if (normalized === SeverityLevel.HIGH)
        return ConsoleSeverity.HIGH;
    if (normalized === SeverityLevel.MEDIUM)
        return ConsoleSeverity.MEDIUM;
    return ConsoleSeverity.LOW;
}
export function countSeverities(findings) {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const finding of findings) {
        const label = severityToConsole(finding.severity);
        if (label === ConsoleSeverity.CRITICAL)
            critical += 1;
        else if (label === ConsoleSeverity.HIGH)
            high += 1;
        else if (label === ConsoleSeverity.MEDIUM)
            medium += 1;
        else
            low += 1;
    }
    return { critical, high, medium, low };
}
