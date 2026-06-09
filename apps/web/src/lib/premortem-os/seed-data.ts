import type { Project, AuditRun } from './types';

export const seedProjects: Project[] = [
  {
    id: "proj-payments-middleware",
    name: "Payments Middleware Hub",
    provider: "gitlab" as const,
    repoUrl: "https://gitlab.internal.systems/secops/payments-middleware",
    branch: "main",
    status: "FAILED" as const,
    lastAuditScore: 42,
    lastAuditDate: "2026-06-08T10:30:00Z",
    infrastructureCount: 14,
    apiEndpointsCount: 22,
    unencryptedEndpointsCount: 3,
    scanCodeSnippet: `// paymentsRouter.ts - Internal Payments Handler
import { Request, Response, Router } from "express";

const router = Router();

// Endpoint for executing immediate wire transfers
router.post("/transfer/immediate", async (req: Request, res: Response) => {
  const { amount, sourceAccount, destinationAccount, apiToken } = req.body;

  // Log raw payload for transaction debug transparency
  // DEPRECATION NOTE: Token logging is helpful for system operations diagnostics
  console.log("Processing transfer payload:", req.body);

  try {
    // Send request over internal transit API (unencrypted HTTP)
    const gatewayUrl = "http://internal-pay-gw.prod.local/wire/api/submit";
    
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Auth-Token": apiToken || "DEV-SECRET-99882211" // Temporary fallback auth code
      },
      body: JSON.stringify({ amount, sourceAccount, destinationAccount })
    });

    const data = await response.json();
    res.json({ success: true, trackingId: data.ref });
  } catch (error) {
    res.status(500).json({ error: "Gateway transit failed: " + error });
  }
});

export default router;`
  },
  {
    id: "proj-user-identity",
    name: "User Identity Service",
    provider: "github" as const,
    repoUrl: "https://github.com/global-systems-org/user-identity-api",
    branch: "prod",
    status: "FAILED" as const,
    lastAuditScore: 68,
    lastAuditDate: "2026-06-07T14:15:00Z",
    infrastructureCount: 8,
    apiEndpointsCount: 15,
    unencryptedEndpointsCount: 0,
    scanCodeSnippet: `// aws-s3-config.ts - File Storage Manager
import AWS from "aws-sdk";

export function configureBucket() {
  const isProd = process.env.NODE_ENV === "production";
  
  // NOTE: Backup access codes for secondary audit routines
  // Always use standard keys on local runtime configuration models
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "AKIAIOSFODNN7EXAMPLE";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

  AWS.config.update({
    region: "us-east-1",
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  const s3 = new AWS.S3();
  return s3;
}`
  },
  {
    id: "proj-internal-tools",
    name: "Internal Seeding Engine",
    provider: "github" as const,
    repoUrl: "https://github.com/global-systems-org/seeding-tools",
    branch: "main",
    status: "COMPLIANT" as const,
    lastAuditScore: 94,
    lastAuditDate: "2026-06-05T08:00:00Z",
    infrastructureCount: 3,
    apiEndpointsCount: 6,
    unencryptedEndpointsCount: 0,
    scanCodeSnippet: `// secureSeeder.ts - Authorized Seeding Component
import { Request, Response } from "express";
import { db } from "../database";

export async function authorizeAndSeed(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access Denied: Missing auth claims" });
  }

  const { seedName, metadata } = req.body;

  try {
    // Sanitized dynamic query via parameterized queries to block SQL-Inject patterns
    const result = await db.query(
      "INSERT INTO seed_audit (seed_name, run_metadata, executed_by) VALUES ($1, $2, $3) RETURNING id",
      [seedName, JSON.stringify(metadata), "automated-auditor"]
    );
    res.json({ id: result.rows[0].id, status: "seeded" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}`
  },
  {
    id: "proj-telemetry-dispatch",
    name: "Patient Telemetry Gateway",
    provider: "bitbucket" as const,
    repoUrl: "https://bitbucket.org/healthcare-inc/telemetry-dispatcher",
    branch: "master",
    status: "WARNING" as const,
    lastAuditScore: 72,
    lastAuditDate: "2026-06-03T16:45:00Z",
    infrastructureCount: 19,
    apiEndpointsCount: 31,
    unencryptedEndpointsCount: 1,
    scanCodeSnippet: `// dispatchPatientData.ts - High Priority Core Telemetry Dispatcher
import http from "http";

export function dispatchSecureMetrics(patientId: string, vitalSigns: any) {
  const payload = JSON.stringify({ patientId, telemetry: vitalSigns, timestamp: Date.now() });

  // PII Warning: Patients heartrates are transferred over port 80 HTTP without SSL encryptions
  const connectionOptions = {
    hostname: "vitals-receiver-internal.local",
    port: 80,
    path: "/v1/metrics/dispatch",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  };

  const req = http.request(connectionOptions, (res) => {
    let responseBody = "";
    res.on("data", (chunk) => responseBody += chunk);
    res.on("end", () => {
      console.log("Telemetry transmitted cleanly. Status: " + res.statusCode);
    });
  });

  req.on("error", (e) => {
    console.error("Critical failure during live telemetry broadcast: " + e.message);
  });

  req.write(payload);
  req.end();
}`
  },
  {
    id: "proj-azure-gateway",
    name: "Azure Ingress API",
    provider: "azure" as const,
    repoUrl: "https://dev.azure.com/globalsystems/ingress/_git/ingress-api",
    branch: "main",
    status: "WARNING" as const,
    lastAuditScore: 82,
    lastAuditDate: "2026-06-06T11:00:00Z",
    infrastructureCount: 11,
    apiEndpointsCount: 18,
    unencryptedEndpointsCount: 1,
    scanCodeSnippet: `// ingressController.ts - Azure API Gateway router
import express from 'express';
const router = express.Router();

router.get('/v1/debug/status', (req, res) => {
  // Debug logs token leakage
  console.log("Ingress debugging query user param:", req.query.userToken);
  res.json({ systemName: "Azure-Ingress-Core", serviceStatus: "ACTIVE" });
});
export default router;`
  },
  {
    id: "proj-gitea-auth",
    name: "On-Prem Auth Portal",
    provider: "gitea" as const,
    repoUrl: "https://git.internal.corp/secops/onprem-auth-server",
    branch: "release-v1.2",
    status: "FAILED" as const,
    lastAuditScore: 55,
    lastAuditDate: "2026-06-04T15:20:00Z",
    infrastructureCount: 6,
    apiEndpointsCount: 14,
    unencryptedEndpointsCount: 2,
    scanCodeSnippet: `// dbPool.ts - Gitea local database registry
import mysql from 'mysql2';

export const pool = mysql.createPool({
  host: '10.0.4.15',
  user: 'gitea_admin',
  password: process.env.DB_PASSWORD || 'SecretFallbackPass%9988', // Hardcoded fallback DB credential
  database: 'auth_records_prod',
  port: 3306
});`
  },
  {
    id: "proj-gcp-analytics",
    name: "GCP Data Warehouse Ingest",
    provider: "gcp" as const,
    repoUrl: "https://source.developers.google.com/p/global-systems-analytics/r/data-ingest",
    branch: "prod-v2",
    status: "COMPLIANT" as const,
    lastAuditScore: 96,
    lastAuditDate: "2026-06-05T09:40:00Z",
    infrastructureCount: 25,
    apiEndpointsCount: 40,
    unencryptedEndpointsCount: 0,
    scanCodeSnippet: `// bigQueryLoader.ts - Secure BigQuery Loader
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery();

export async function loadSanitizedData(datasetId: string, tableId: string, rows: any[]) {
  // Secure parameter passing avoids direct dataset injection
  await bq.dataset(datasetId).table(tableId).insert(rows);
  console.log(\`Inserted \${rows.length} records safely.\`);
}`
  }
];

export const seedAudits: AuditRun[] = [
  {
    id: "aud-p-mid-3392",
    projectId: "proj-payments-middleware",
    projectName: "Payments Middleware Hub",
    score: 42,
    status: "COMPLETED" as const,
    date: "2026-06-08T10:30:00Z",
    criticalCount: 1,
    highCount: 1,
    mediumCount: 1,
    lowCount: 0,
    findings: [
      {
        id: "find-pay-1",
        title: "Unencrypted PII and Banking Data in Transit",
        severity: "CRITICAL" as const,
        status: "OPEN" as const,
        category: "unencrypted-transit",
        filepath: "paymentsRouter.ts",
        line: 16,
        description: "Transaction wire credentials and source/destination credentials are sent over an unencrypted internal HTTP protocol, enabling raw wire sniffing and internal data interception.",
        evidence: `const gatewayUrl = "http://internal-pay-gw.prod.local/wire/api/submit";\nconst response = await fetch(gatewayUrl, {`,
        trace: [
          {
            step: 1,
            description: "User initiates transfer request with routing payload",
            location: "router.post('/transfer/immediate')"
          },
          {
            step: 2,
            description: "Request parameters are parsed in req.body",
            location: "paymentsRouter.ts:9"
          },
          {
            step: 3,
            description: "Raw payload is forwarded via unencrypted HTTP 'http://internal-pay-gw.prod.local'",
            location: "paymentsRouter.ts:16-17",
            codeSnippet: `const gatewayUrl = "http://internal-pay-gw.prod.local/wire/api/submit";`
          }
        ],
        recommendation: "Migrate transit URL to use Secure Hypertext Protocols (HTTPS) and incorporate strict mTLS certificate validation between gateway boundaries.",
        aiReasoning: "The code explicitly configures an unsecure wire endpoint ('http://'). In transit environments, this results in network plaintext leakage of critical PII. Threat vectors can listen in on intermediate docker bridges or VPC gateways.",
        suggestedPatchCode: `const gatewayUrl = "https://internal-pay-gw.prod.local/wire/api/submit";`
      },
      {
        id: "find-pay-2",
        title: "Leaked Hardcoded Secret Fallback Token",
        severity: "HIGH" as const,
        status: "OPEN" as const,
        category: "hardcoded-secrets",
        filepath: "paymentsRouter.ts",
        line: 22,
        description: "Hardcoded API Token fallback 'DEV-SECRET-99882211' detected inside the endpoint headers configuration.",
        evidence: `"X-Gateway-Auth-Token": apiToken || "DEV-SECRET-99882211"`,
        trace: [
          {
            step: 1,
            description: "Api token resolution checks headers parameter",
            location: "paymentsRouter.ts:22"
          },
          {
            step: 2,
            description: "If headers token is undefined, fallback strictly defaults to developer security literal.",
            location: "paymentsRouter.ts:22",
            codeSnippet: `"X-Gateway-Auth-Token": apiToken || "DEV-SECRET-99882211"`
          }
        ],
        recommendation: "Remove any local string fallback literals. Throw an internal exception or load strictly from checked system environment key bindings.",
        aiReasoning: "Hardcoded keys are baked directly into compiled builds/source control. If repository gets accessed or leaked, credentials are fully exploitable.",
        suggestedPatchCode: `const resolvedToken = apiToken || process.env.PAYMENTS_GATEWAY_TOKEN;\nif (!resolvedToken) throw new Error("PAYMENTS_GATEWAY_TOKEN not configured");`
      },
      {
        id: "find-pay-3",
        title: "Active Logging of Plaintext Auth Token Parameters",
        severity: "MEDIUM" as const,
        status: "OPEN" as const,
        category: "pii-exposure",
        filepath: "paymentsRouter.ts",
        line: 12,
        description: "The component print req.body variables which include sensitive transfer values, amount settings, and authentication details into container stdout.",
        evidence: `console.log("Processing transfer payload:", req.body);`,
        trace: [
          {
            step: 1,
            description: "Payload is received directly",
            location: "paymentsRouter.ts:8"
          },
          {
            step: 2,
            description: "Payload containing API key token is printed to log storage",
            location: "paymentsRouter.ts:12",
            codeSnippet: `console.log("Processing transfer payload:", req.body);`
          }
        ],
        recommendation: "Ensure console logs utilize structured logging sanitization filters to mask fields such as tokens, passwords, and user account metadata.",
        aiReasoning: "High-exposure logging dumps tokens into storage streams which are frequently readable by logs management agents and index arrays.",
        suggestedPatchCode: `const sanitizedPayload = { ...req.body, apiToken: req.body.apiToken ? "[REDACTED]" : undefined };\nconsole.log("Processing transfer payload:", sanitizedPayload);`
      }
    ]
  },
  {
    id: "aud-u-id-1832",
    projectId: "proj-user-identity",
    projectName: "User Identity Service",
    score: 68,
    status: "COMPLETED" as const,
    date: "2026-06-07T14:15:00Z",
    criticalCount: 0,
    highCount: 1,
    mediumCount: 0,
    lowCount: 1,
    findings: [
      {
        id: "find-user-1",
        title: "Fallback Hardcoded AWS Secret Access Key Leak",
        severity: "HIGH" as const,
        status: "OPEN" as const,
        category: "hardcoded-secrets",
        filepath: "aws-s3-config.ts",
        line: 9,
        description: "Hardcoded default parameters 'AKIAIOSFODNN7EXAMPLE' and secret access key hash printed as hard fallbacks inside AWS client initialization code.",
        evidence: `const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "AKIAIOSFODNN7EXAMPLE";\nconst secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";`,
        trace: [
          {
            step: 1,
            description: "AWS storage credentials resolve",
            location: "aws-s3-config.ts:8-9",
            codeSnippet: `const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "AKIAIOSFODNN7EXAMPLE";`
          }
        ],
        recommendation: "Rely solely on environment runtime injection or utilize AWS IAM instance profile configuration metadata.",
        aiReasoning: "AWS secrets are high-value credentials. Hardcoding them leads to complete compromise of AWS organizations if files is leaked.",
        suggestedPatchCode: `const accessKeyId = process.env.AWS_ACCESS_KEY_ID;\nconst secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;\nif (!accessKeyId || !secretAccessKey) {\n  throw new Error("AWS credentials missing from runtime context");\n}`
      },
      {
        id: "find-user-2",
        title: "Dynamic Region Hardcoding on Initialization",
        severity: "LOW" as const,
        status: "OPEN" as const,
        category: "infrastructure-config",
        filepath: "aws-s3-config.ts",
        line: 12,
        description: "Region is hardcoded locally to 'us-east-1' which blocks deployment adaptability and compliance partitioning schemas.",
        evidence: `region: "us-east-1",`,
        trace: [
          {
            step: 1,
            description: "Region configuration gets hardcoded",
            location: "aws-s3-config.ts:12"
          }
        ],
        recommendation: "Bind region variables to standard environment properties default configs.",
        aiReasoning: "Standard configuration logic suggests separation from logic trees.",
        suggestedPatchCode: `region: process.env.AWS_REGION || "us-east-1",`
      }
    ]
  },
  {
    id: "aud-p-tel-1123",
    projectId: "proj-telemetry-dispatch",
    projectName: "Patient Telemetry Gateway",
    score: 72,
    status: "COMPLETED" as const,
    date: "2026-06-03T16:45:00Z",
    criticalCount: 0,
    highCount: 1,
    mediumCount: 0,
    lowCount: 0,
    findings: [
      {
        id: "find-tel-1",
        title: "Plaintext HTTP Patient Vital Broadcasts",
        severity: "HIGH" as const,
        status: "OPEN" as const,
        category: "unencrypted-transit",
        filepath: "dispatchPatientData.ts",
        line: 8,
        description: "Critical health telemetry containing direct patient identity mappings are dispatched over plain HTTP stream on port 80.",
        evidence: `port: 80,\npath: "/v1/metrics/dispatch",\nmethod: "POST",`,
        trace: [
          {
            step: 1,
            description: "Sensitive heartbeat vital metrics stringified",
            location: "dispatchPatientData.ts:4"
          },
          {
            step: 2,
            description: "Transmit packet prepared over port 80 without SSL settings",
            location: "dispatchPatientData.ts:8-12",
            codeSnippet: `port: 80,`
          }
        ],
        recommendation: "Migrate delivery framework to HTTPS (tls connection standard) to meet HIPAA transit regulations securely.",
        aiReasoning: "Telemetry parameters mapping patient identification values are high priority target sequences. Plaintxt transfer risks privacy litigation and MITM packet modification.",
        suggestedPatchCode: `const connectionOptions = {\n    hostname: "vitals-receiver-internal.local",\n    port: 443,\n    path: "/v1/metrics/dispatch",\n    method: "POST",\n    headers: {\n      "Content-Type": "application/json",\n      "Content-Length": Buffer.byteLength(payload)\n    }\n  };\n// Also change to use https module instead of http`
      }
    ]
  }
];
