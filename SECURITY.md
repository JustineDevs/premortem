# Security Policy

## Supported versions

This project is currently in early alpha. The latest tagged version is the only supported version for security fixes.

## Reporting a vulnerability

Please do not open public issues for suspected vulnerabilities.

Report security concerns privately to the maintainers through a private channel before public disclosure. Include:
- A clear description of the issue.
- Reproduction steps or proof of concept.
- Affected files, services, or environments.
- Severity estimate and possible impact.
- Suggested remediation if available.

## Handling secrets

- Never commit credentials, provider tokens, service-role keys, or private certificates.
- Store local sensitive material only in ignored paths such as `/secrets`, `/internal`, or environment variables.
- Browser clients must never receive raw provider secrets or backend service keys.

## Disclosure expectations

We will aim to acknowledge valid reports promptly, reproduce the issue, assess severity, prepare a fix, and coordinate disclosure timing with the reporter.
