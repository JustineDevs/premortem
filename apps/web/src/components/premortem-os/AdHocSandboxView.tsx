'use client';

import { useCallback, useMemo, useState } from 'react';
import { Finding, type Project, type TraceStep } from '@/lib/premortem-os/types';
import { 
  Terminal, 
  Play, 
  Sparkles, 
  Wrench, 
  Radio,
  FileCode
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { selectRealProject } from '@/lib/premortem-os/project-selection';
import {
  AiArtifactCard,
  AiCheckpointCard,
  AiConversationCard,
  AiReasoningCard,
  AiSchemaDisplayCard,
  AiSourceItem,
  AiSourcesCard,
  AiSuggestionRow,
  AiTaskList,
  AiTerminalCard,
  AiToolTimeline
} from './ai-elements';

const SANDBOX_EDITOR_ID = 'adhoc-sandbox-source-code';
const SANDBOX_TEMPLATES = [
  {
    name: 'SQL injection and secret logging',
    code: `// Paste or select a custom backend code block here
import mysql from 'mysql2/promise';

export async function processLogin(req, res) {
  const { user, password } = req.body;
  
  // VULNERABILITY: SQL Injection
  const connection = await mysql.createConnection({ host: 'localhost', user: 'admin_root' });
  const [rows] = await connection.query(
    "SELECT * FROM accounts WHERE username = '" + user + "' AND pw = '" + password + "'"
  );
  
  // VULNERABILITY: plaintext credential logging
  console.log("Authenticated username match payload: ", user, " pw: ", password);

  res.json({ match: rows.length > 0 });
}`
  },
  {
    name: 'Plain HTTP Vital Dispatch',
    code: `// Patient Vital broadcast over plain-text network
import http from 'http';

export function sendVitals(patientId, records) {
  const body = JSON.stringify({ patientId, records });
  
  // Port 80 unencrypted transit
  const req = http.request({
    hostname: "internal-dispatch.vitals.local",
    port: 80,
    path: "/metrics/submit",
    method: "POST"
  });
  
  req.write(body);
  req.end();
}`
  },
  {
    name: 'Hardcoded AWS Config Keys',
    code: `// AWS bucket storage loader
import S3Client from 'aws-sdk/clients/s3';

const accessID = "AKIAID8481EXAMPLE2";
const secretKEY = "yJb/M719YHD9+D19YJD81FEXAMPLEHOLDER_KEY";

export function initializeS3() {
  return new S3Client({
    accessKeyId: accessID,
    secretAccessKey: secretKEY,
    region: 'us-west-2'
  });
}`
  }
] as const;

function traceStepKey(step: TraceStep) {
  return `${step.step}-${step.location}-${step.description}`;
}

interface AdHocSandboxViewProps {
  projects: Project[];
  onAnalyzeSnippet: (code: string, projectId?: string) => Promise<{
    success: boolean;
    audit?: {
      score: number;
      findings: Finding[];
    };
    error?: string;
  }>;
}

function buildSchemaExample(projectId: string, projectBranch: string) {
  return {
    method: 'POST',
    endpoint: '/api/audits',
    request: JSON.stringify(
      {
        projectId,
        branch: projectBranch,
        codeSnippet: '<pasted source snippet>'
      },
      null,
      2
    ),
    response: JSON.stringify(
      {
        auditRunId: 'audit_123',
        status: 'queued',
        next: 'orchestrator will analyze the snippet'
      },
      null,
      2
    )
  };
}

export function AdHocSandboxView({ projects, onAnalyzeSnippet }: AdHocSandboxViewProps) {
  const [code, setCode] = useState(`// Paste or select a custom backend code block here
import mysql from 'mysql2/promise';

export async function processLogin(req, res) {
  const { user, password } = req.body;
  
  // VULNERABILITY 1: SQL Injection
  const connection = await mysql.createConnection({ host: 'localhost', user: 'root' });
  const [rows] = await connection.query(
    "SELECT * FROM accounts WHERE username = '" + user + "' AND pw = '" + password + "'"
  );
  
  // VULNERABILITY 2: plaintext credential logging
  console.log("Authenticated username match payload: ", user, " pw: ", password);

  res.json({ match: rows.length > 0 });
}`);

  const [isLoading, setIsLoading] = useState(false);
  const [scanResult, setScanResult] = useState<{
    score: number;
    findings: Finding[];
  } | null>(null);
  const [errorWord, setErrorWord] = useState<string | null>(null);
  const selectedProject = useMemo(() => selectRealProject(projects), [projects]);
  const schemaExample = useMemo(
    () =>
      buildSchemaExample(
        selectedProject?.id ?? 'connected-project',
        selectedProject?.branch ?? 'main'
      ),
    [selectedProject]
  );

  const resetScanState = useCallback((nextCode: string) => {
    setCode(nextCode);
    setScanResult(null);
    setErrorWord(null);
  }, []);

  const sampleSuggestions = useMemo(
    () =>
      SANDBOX_TEMPLATES.map((template) => ({
        label: template.name,
        detail: 'Load sample',
        onClick: () => resetScanState(template.code)
      })),
    [resetScanState]
  );

  const conversationItems = useMemo(
    () => [
      {
        role: 'user' as const,
        title: 'Prompt input',
        body: (
          <span>
            Analyze the pasted snippet for exploitable patterns, secret exposure,
            and transport risk.
          </span>
        ),
        meta: 'PromptInput'
      },
      {
        role: 'assistant' as const,
        title: scanResult ? `Audit completed with ${scanResult.score}% compliance` : 'Waiting for analysis',
        body: scanResult ? (
          <span>
            {scanResult.findings.length} findings extracted from the runtime audit
            pipeline.
          </span>
        ) : (
          <span>Run analysis to stream a real audit response.</span>
        ),
        meta: scanResult ? 'Conversation / Message' : 'Conversation'
      },
      ...(errorWord
        ? [
            {
              role: 'tool' as const,
              title: 'Execution error',
              body: <span>{errorWord}</span>,
              meta: 'Tool'
            }
          ]
        : [])
    ],
    [errorWord, scanResult]
  );

  const sourceItems = useMemo<AiSourceItem[]>(
    () =>
      scanResult
        ? scanResult.findings.flatMap((finding) => {
            const traceSteps = Array.isArray(finding.trace) ? finding.trace : [];
            if (traceSteps.length === 0) {
              return [
                {
                  label: `${finding.title}`,
                  detail: `${finding.filepath}:${finding.line} · ${finding.evidence}`,
                  href: undefined
                }
              ];
            }

            return traceSteps.slice(0, 3).map((step) => ({
              label: `${finding.title} · step ${step.step}`,
              detail: `${step.location} · ${step.description}`,
              href: undefined
            }));
          })
        : [
            {
              label: 'Sample snippet templates',
              detail: 'Use the built-in prompt suggestions to load realistic audit inputs.',
              href: undefined
            }
          ],
    [scanResult]
  );

  const terminalLines = useMemo(() => {
    if (isLoading) {
      return ['Submitting audit job to the orchestrator', 'Waiting for audit response...'];
    }

    if (errorWord) {
      return [`Audit failed: ${errorWord}`];
    }

    if (!scanResult) {
      return ['Idle inspection lab ready', 'Select a sample or paste code, then run analysis.'];
    }

    return [
      `Audit score ${scanResult.score}%`,
      ...scanResult.findings.slice(0, 5).map((finding) => `${finding.severity} ${finding.title}`),
      `Findings total: ${scanResult.findings.length}`
    ];
  }, [errorWord, isLoading, scanResult]);

  const taskItems = useMemo(
    () => [
      {
        label: 'Prompt',
        detail: 'Collect code and route it through the real audit pipeline.',
        state: code.trim() ? ('completed' as const) : ('pending' as const)
      },
      {
        label: 'Analysis',
        detail: isLoading
          ? 'The orchestrator is scanning the snippet.'
          : scanResult
            ? `Returned ${scanResult.findings.length} findings.`
            : 'Waiting for a run.',
        state: isLoading ? ('running' as const) : scanResult ? ('completed' as const) : ('pending' as const)
      },
      {
        label: 'Review',
        detail: scanResult ? 'Inspect sources, reasoning, and suggested patches.' : 'No findings to review yet.',
        state: scanResult ? ('completed' as const) : ('pending' as const)
      }
    ],
    [code, isLoading, scanResult]
  );

  const checkpointItem = useMemo(
    () => ({
      phase: isLoading ? 'queued / running' : errorWord ? 'failed' : scanResult ? 'finished' : 'idle',
      savedAt: scanResult ? 'now' : 'n/a',
      summary: scanResult
        ? 'The inspection lab submitted a real audit job and rendered orchestrator output.'
        : errorWord
          ? 'The inspection lab surfaced a real execution error instead of masking the failure.'
          : 'The inspection lab is ready for a real audit run.'
    }),
    [errorWord, isLoading, scanResult]
  );

  const handleScan = async () => {
    if (!selectedProject) {
      setErrorWord('Register a real project before running a sandbox audit.');
      setScanResult(null);
      return;
    }

    setIsLoading(true);
    setErrorWord(null);
    setScanResult(null);

    try {
      const data = await onAnalyzeSnippet(code, selectedProject?.id);
      if (data && data.success) {
        setScanResult(data.audit ?? null);
      } else {
        setErrorWord(data?.error || "Scanning pipeline returned an invalid state.");
      }
    } catch (error: unknown) {
      setErrorWord(
        error instanceof Error ? error.message : 'Execution exception triggered inside the inspection lab.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FBFBFA] px-4 py-5 font-sans text-[#1E2522] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-4 animate-fadeIn">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[236px_minmax(0,1.55fr)_348px] 2xl:grid-cols-[252px_minmax(0,1.65fr)_388px] items-start">
          <aside className="space-y-4 self-stretch min-h-0 xl:sticky xl:top-5 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <div className="rounded-[20px] border border-[#EAE6DF] bg-[#FAF8F5] p-3.5 shadow-sm">
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]">
                  Prompt input
                </p>
                <h3 className="text-lg font-bold text-[#1E2522]">Ad hoc inspection audit</h3>
                <p className="text-xs leading-relaxed text-[#5C6560]">
                  Paste a snippet, load a sample, then submit a real audit job against the connected project inventory.
                </p>
              </div>
              <div className="mt-3 rounded-2xl border border-[#D9E5DD] bg-white px-3 py-2 text-[11px] leading-relaxed text-[#3C4A45]">
                <span className="font-mono font-bold uppercase tracking-[0.2em] text-[#7C8781]">
                  Target project
                </span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-900">
                    {selectedProject?.name ?? 'Connected project'}
                  </span>
                  <span className="font-mono text-[10px] text-[#717A75]">
                    {selectedProject?.branch ? `branch ${selectedProject.branch}` : 'branch main'}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-2.5">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]">
                  Sample snippets
                </p>
                <div className="max-h-[220px] overflow-y-auto pr-1">
                  <AiSuggestionRow items={sampleSuggestions} className="flex-col" />
                </div>
                </div>
              </div>
            <AiTaskList items={taskItems} />
          </aside>

          <section className="space-y-4 min-w-0 min-h-0">
            <div className="rounded-[20px] border border-[#EAE6DF] bg-[#FAF8F5] p-4 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[#EAE6DF] pb-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]">
                    Main workspace
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[#1E2522]">Source snippet</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#5C6560]">
                    Paste code in the center rail. The right panel updates with evidence, reasoning, and the
                    returned findings once the orchestrator completes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={isLoading || !code.trim()}
                  aria-label="Run snippet analysis"
                  className="inline-flex items-center justify-center gap-2 rounded border border-emerald-950 bg-emerald-950 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Running audit…</span>
                    </>
                  ) : (
                    <>
                      <Play size={13} className="fill-current" />
                      <span>Run analysis</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3 space-y-2.5">
                <label
                  htmlFor={SANDBOX_EDITOR_ID}
                  className="block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]"
                >
                  Sandbox source snippet
                </label>
                <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-sm">
                  <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950/80 px-3 py-2 font-mono text-[10px] text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="font-bold text-[#A6BCB4]">
                        {selectedProject?.name ? `${selectedProject.name}.snippet.ts` : 'sample_input.ts'}
                      </span>
                    </div>
                    <span>UTF-8 TS Code</span>
                  </div>
                  <textarea
                    id={SANDBOX_EDITOR_ID}
                    rows={16}
                    value={code}
                    onChange={(e) => resetScanState(e.target.value)}
                    className="h-[420px] w-full resize-none border-none bg-neutral-950 p-4 font-mono text-xs leading-relaxed text-[#F5F4F0] focus:outline-none"
                    placeholder="// Write or paste server files, controllers, or database models here..."
                  />
                </div>
              </div>
            </div>

            <AiSchemaDisplayCard item={schemaExample} />
          </section>

          <aside className="space-y-4 self-stretch min-h-0 xl:sticky xl:top-5 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <div className="rounded-[20px] border border-[#EAE6DF] bg-[#FAF8F5] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]">
                    Connected audit
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#1E2522]">Real orchestrator run</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-900">
                  live
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#5C6560]">
                This panel creates a real audit job for the pasted snippet and shows the orchestrator findings when the run completes.
              </p>
              <div className="mt-3">
                <AiCheckpointCard item={checkpointItem} />
              </div>
            </div>
            {isLoading ? (
            <div className="rounded-[20px] border border-[#EAE6DF] bg-[#FAF8F5] p-4 text-center shadow-sm">
              <Sparkles size={24} className="mx-auto text-emerald-800 animate-pulse" />
              <p className="mt-3 text-sm font-bold text-zinc-800">Submitting real audit job…</p>
              <p className="mx-auto mt-1 max-w-xs text-[10px] text-[#5C6560]">
                The snippet is being submitted to the orchestrator. Results stream back as AI Elements-style
                findings.
              </p>
            </div>
          ) : errorWord ? (
            <div className="rounded-[20px] border border-red-200 bg-red-50 p-4 text-xs text-red-800 shadow-sm">
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em]">
                <Radio className="text-red-600 animate-pulse" size={12} />
                Analysis failed
              </div>
              <p className="mt-3 leading-relaxed">{errorWord}</p>
            </div>
          ) : scanResult ? (
            <div className="space-y-4">
              <div className="rounded-[20px] border border-[#EAE6DF] bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-[#EAE6DF] pb-3">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-neutral-400">
                      Compliance index
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#1E2522]">{scanResult.score}% compliant</p>
                  </div>
                  <span
                    className={cn(
                      'rounded border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em]',
                      scanResult.score >= 85
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    )}
                  >
                    {scanResult.score >= 85 ? 'passed' : 'vulnerability warning'}
                  </span>
                </div>

                <AiConversationCard items={conversationItems} />
              </div>

              <AiReasoningCard
                title="Reasoning"
                summary={`The audit surfaced ${scanResult.findings.length} finding(s) through the real orchestrator path, not a local heuristic scanner.`}
                steps={[
                  'The pasted code is sent to the audit pipeline and parsed into structured findings.',
                  'The output is rendered as a conversation-like thread so users can read the result like an AI assistant response.',
                  'The result area stays aligned with the rest of Premortem: evidence, reasoning, and action guidance.'
                ]}
              />

              <AiSourcesCard items={sourceItems} />

              <AiToolTimeline
                items={[
                  { title: 'submit audit job', detail: 'POST /api/audits with the connected project and pasted code', state: 'completed' },
                  { title: 'orchestrator analysis', detail: 'Security agents inspect the snippet and generate findings', state: isLoading ? 'running' : 'completed' },
                  { title: 'render evidence', detail: 'The UI converts findings into cards, code blocks, and source refs', state: scanResult ? 'completed' : 'pending' }
                ]}
              />

              <AiArtifactCard
                title="Finding artifact"
                description="The first finding becomes a reusable AI artifact with patch guidance."
                content={
                  scanResult.findings[0] ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-rose-800">
                          {scanResult.findings[0].severity}
                        </span>
                        <span className="text-[10px] font-mono text-[#8A958F]">
                          {scanResult.findings[0].filepath}:{scanResult.findings[0].line}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#1E2522]">{scanResult.findings[0].title}</p>
                      <p className="text-xs leading-relaxed text-[#5C6560]">{scanResult.findings[0].recommendation}</p>
                      {scanResult.findings[0].suggestedPatchCode ? (
                        <pre className="overflow-x-auto rounded bg-neutral-950 p-3 font-mono text-[10px] leading-relaxed text-neutral-200">
                          {scanResult.findings[0].suggestedPatchCode}
                        </pre>
                      ) : null}
                    </div>
                  ) : (
                    <span>No findings returned.</span>
                  )
                }
              />

              <AiTerminalCard title="Terminal output" lines={terminalLines} />

              <div className="rounded-[20px] border border-[#EAE6DF] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-[#8A958F]" />
                  <h3 className="text-sm font-bold text-[#1E2522]">Finding list</h3>
                </div>
                <div className="mt-4 space-y-4">
                  {scanResult.findings.map((finding: Finding) => {
                    const traceSteps = Array.isArray(finding.trace) ? finding.trace : [];
                    return (
                      <div
                        key={`${finding.title}-${finding.filepath}-${finding.line}-${finding.category}`}
                        className="rounded border border-[#EAE6DF] bg-[#FAF8F5]/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3 text-[10px] font-mono">
                          <span className="rounded-sm border border-rose-200 bg-rose-50 px-2 py-0.5 font-bold text-rose-800">
                            {finding.severity}
                          </span>
                          <span className="text-[#5C6560]">
                            Line {finding.line} · {finding.category}
                          </span>
                        </div>

                        <h4 className="mt-2 text-sm font-bold text-neutral-900">{finding.title}</h4>

                        <p className="mt-2 text-xs leading-relaxed text-[#5C6560]">{finding.description}</p>

                        {traceSteps.length > 0 ? (
                          <div className="mt-3 space-y-2 border-t border-[#EAE6DF] pt-3">
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.22em] text-[#8A958F]">
                              Execution trace
                            </p>
                            <div className="space-y-2 border-l border-dashed border-emerald-800 pl-3">
                              {traceSteps.map((step) => (
                                <div key={traceStepKey(step)} className="text-[11px] text-zinc-800">
                                  <span className="font-mono font-bold text-emerald-900">{step.step}.</span>{' '}
                                  <span className="font-bold uppercase tracking-wide">{step.location}</span>: {step.description}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 rounded border border-[#EAE6DF] bg-white p-3">
                          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#717A75]">
                            Resolution guideline
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-[#5C6560]">{finding.recommendation}</p>
                        </div>

                        {finding.suggestedPatchCode ? (
                          <div className="mt-3 space-y-1.5 border-t border-[#EAE6DF] pt-3">
                            <div className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-[0.22em] text-indigo-800">
                              <Wrench size={10} />
                              Suggested patch
                            </div>
                            <pre className="max-h-[140px] overflow-x-auto rounded bg-neutral-950 p-3 font-mono text-[10px] leading-relaxed text-neutral-300">
                              {finding.suggestedPatchCode}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-[#EAE6DF] bg-[#FAF8F5] p-8 text-center shadow-sm">
              <Terminal size={24} className="mx-auto text-[#8A958F] animate-pulse" />
              <div className="mx-auto mt-3 max-w-xs space-y-1">
                <p className="font-bold text-zinc-800">No analysis results yet</p>
                <p className="text-[10px] text-zinc-400">
                  Select an example or paste code and run analysis to generate findings.
                </p>
              </div>
            </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
