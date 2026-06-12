const SANDBOX_SOURCE = 'sandbox-snippet.ts';

export function performStaticAudit(codeToScan: string): { overallScore: number; findings: any[] } {
  const findings: any[] = [];
  
  // Normalize whitespace to make matching robust
  const normalized = codeToScan.replace(/\s+/g, ' ');

  // 1. Check for SQL injection / SQL concatenation
  if (
    normalized.includes("SELECT") && 
    (normalized.includes("+") || normalized.includes("${")) && 
    (normalized.includes("WHERE") || normalized.includes("query"))
  ) {
    findings.push({
      title: "SQL Query String Concatenation Vulnerability",
      severity: "CRITICAL" as const,
      category: "sql-injection",
      filepath: SANDBOX_SOURCE,
      line: 1,
      description: "Detected SQL query string concatenation inside database execution commands. This is a demo scanner finding, not a repository-aware orchestrator finding.",
      evidence: "SELECT * FROM accounts WHERE username = '\" + user + \"' AND pw = '\" + password + \"'",
      trace: [
        { step: 1, description: "Unsanitized user parameters received in transaction body request context", location: SANDBOX_SOURCE },
        { step: 2, description: "Raw parameter strings concatenated directly into live query execution thread", location: SANDBOX_SOURCE }
      ],
      recommendation: "Replace custom concatenated query strings with fully parameterized input placeholders (like ? or postgres bindings).",
      aiReasoning: "Static pattern match: raw parameter injection bypasses application authentication safeguards.",
      suggestedPatchCode: "const [rows] = await connection.query(\n  \"SELECT * FROM accounts WHERE username = ? AND pw = ?\",\n  [user, password]\n);"
    });
  }

  // 2. Plaintext credentials logging
  if (
    normalized.includes("console.log") && 
    (normalized.includes("password") || normalized.includes("pw") || normalized.includes("apiToken") || normalized.includes("Token") || normalized.includes("keys") || normalized.includes("secret"))
  ) {
    findings.push({
      title: "Plaintext Sensitive Credentials Output in Process Logs",
      severity: "MEDIUM" as const,
      category: "pii-exposure",
      filepath: SANDBOX_SOURCE,
      line: 1,
      description: "Critical user credential parameters, tokens, or password strings are written directly into process standard logs. This is a demo scanner finding, not a repository-aware orchestrator finding.",
      evidence: "console.log(\"Authenticated username match payload: \", user, \" pw: \", password);",
      trace: [
        { step: 1, description: "User credentials resolved inside middleware parameters", location: SANDBOX_SOURCE },
        { step: 2, description: "Raw credentials parameters dumped straight into standard stdout logs stream", location: SANDBOX_SOURCE }
      ],
      recommendation: "Ensure console logs utilize structured logging filters or remove standard debug streams inside production modules entirely.",
      aiReasoning: "Static pattern match: debug prints may expose passwords or tokens in log streams.",
      suggestedPatchCode: "console.log(\"Authenticated match query executed safely for user: \", user);"
    });
  }

  // 3. Unencrypted transit HTTP / port 80
  if (
    normalized.includes("http://") || 
    normalized.includes("port: 80") || 
    (normalized.includes("http") && normalized.includes("80"))
  ) {
    findings.push({
      title: "Unencrypted Transit Communication Protocol (HTTP)",
      severity: "HIGH" as const,
      category: "unencrypted-transit",
      filepath: SANDBOX_SOURCE,
      line: 1,
      description: "Transmitting confidential data over unsecure protocols (Port 80/HTTP). This is a demo scanner finding, not a repository-aware orchestrator finding.",
      evidence: "port: 80",
      trace: [
        { step: 1, description: "System serializes data structures for transport package", location: SANDBOX_SOURCE },
        { step: 2, description: "Network connection requested over plain-text unencrypted interface coordinates", location: SANDBOX_SOURCE }
      ],
      recommendation: "Update the host bindings and options to enforce secure TLS/SSL protocol handshakes on Port 443 (HTTPS).",
      aiReasoning: "Static pattern match: sensitive payloads over plain HTTP invite packet sniffing.",
      suggestedPatchCode: "port: 443, // Enabled standard HTTPS SSL TLS encryption"
    });
  }

  // 4. Hardcoded AWS Keys fallback
  if (
    normalized.includes("AKIA") || 
    normalized.includes("secretKEY") || 
    normalized.includes("accessKeyId") && normalized.includes("EXAMPLE")
  ) {
    findings.push({
      title: "Hardcoded default AWS Access Credentials Keys",
      severity: "HIGH" as const,
      category: "hardcoded-secrets",
      filepath: SANDBOX_SOURCE,
      line: 1,
      description: "Detection of hardcoded programmatic cloud configuration hashes or AWS secret strings compiled inside source lines. This is a demo scanner finding, not a repository-aware orchestrator finding.",
      evidence: "const accessID = \"AKIA...\";",
      trace: [
        { step: 1, description: "Application launches AWS storage gateway parameters", location: SANDBOX_SOURCE },
        { step: 2, description: "Credentials resolve to hardcoded strings defined in source control", location: SANDBOX_SOURCE }
      ],
      recommendation: "Load AWS access profiles or programmatic credentials strictly from process environment parameters or cloud config resources.",
      aiReasoning: "Static pattern match: static access IDs in source control increase cloud compromise risk.",
      suggestedPatchCode: "const accessKeyId = process.env.AWS_ACCESS_KEY_ID;\nconst secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;\nif (!accessKeyId || !secretAccessKey) {\n  throw new Error('Required AWS secrets are missing from environmental variables.');\n}"
    });
  }

  if (findings.length === 0) {
    findings.push({
      title: "No matching static security patterns",
      severity: "LOW" as const,
      category: "compliance-success",
      filepath: SANDBOX_SOURCE,
      line: 1,
      description: "The pasted snippet did not match the playground's static rules (SQL concatenation, credential logging, plain HTTP, or hardcoded cloud keys). This is a demo scanner only. Run a full repository audit from Projects for orchestrator findings.",
      evidence: "// No rule matches in pasted snippet",
      trace: [
        { step: 1, description: "Static playground rules evaluated", location: SANDBOX_SOURCE }
      ],
      recommendation: "For repository-wide analysis, register a project and launch a Premortem security scan.",
      aiReasoning: "Static demo pattern scan only; this is not a substitute for a full orchestrator audit.",
      suggestedPatchCode: ""
    });
  }

  // Calculate score based on findings
  let score = 100;
  for (const f of findings) {
    if (f.severity === "CRITICAL") score -= 45;
    else if (f.severity === "HIGH") score -= 25;
    else if (f.severity === "MEDIUM") score -= 15;
    else if (f.severity === "LOW") score -= 5;
  }
  score = Math.max(10, Math.min(100, score));

  return { overallScore: score, findings };
}
