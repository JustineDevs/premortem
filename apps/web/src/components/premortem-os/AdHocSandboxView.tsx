import React, { useState } from 'react';
import { Finding } from '@/lib/premortem-os/types';
import { 
  Terminal, 
  Play, 
  Sparkles, 
  Wrench, 
  ShieldCheck, 
  HelpCircle,
  Clock,
  Sparkle,
  Radio,
  FileCode
} from 'lucide-react';
import { OsStepper, type OsStep } from './os-stepper';

interface AdHocSandboxViewProps {
  onAnalyzeSnippet: (code: string) => Promise<any>;
}

export function AdHocSandboxView({ onAnalyzeSnippet }: AdHocSandboxViewProps) {
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
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [errorWord, setErrorWord] = useState<string | null>(null);

  const templates = [
    {
      name: "SQL Injection & Print Token",
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
      name: "Plain HTTP Vital Dispatch",
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
      name: "Hardcoded AWS Config Keys",
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
  ];

  const handleScan = async () => {
    setIsLoading(true);
    setErrorWord(null);
    setScanResult(null);

    try {
      const data = await onAnalyzeSnippet(code);
      if (data && data.success) {
        setScanResult(data.audit);
      } else {
        setErrorWord(data?.error || "Scanning pipeline returned an invalid state.");
      }
    } catch (e: any) {
      setErrorWord(e.message || "Execution exception triggered inside code sandbox.");
    } finally {
      setIsLoading(false);
    }
  };

  const scanSteps: OsStep[] = [
    {
      id: 'edit',
      label: 'Edit snippet',
      status: code.trim()
        ? isLoading || scanResult || errorWord
          ? 'done'
          : 'active'
        : 'pending'
    },
    {
      id: 'scan',
      label: 'Run analyzer',
      status: errorWord
        ? 'error'
        : isLoading
          ? 'active'
          : scanResult
            ? 'done'
            : 'pending'
    },
    {
      id: 'review',
      label: 'Review findings',
      status: scanResult ? 'active' : 'pending'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans max-w-7xl mx-auto w-full space-y-8 animate-fadeIn">
      {/* Title Header */}
      <div className="border-b border-[#EAE6DF] pb-6">
        <span className="text-[10px] uppercase tracking-widest font-mono text-[#8A958F] block">
          Demo Inspection Lab
        </span>
        <h2 className="text-2xl font-semibold tracking-tight text-[#1E2522] font-display mt-1">
          Static Demo Scanner
        </h2>
        <p className="text-xs text-[#5C6560] mt-1 mb-3">
          Paste server-side TypeScript or JSON snippets to run the local static demo scanner. Full orchestrator audits run from Projects or Audits.
        </p>

        {/* Explain the API config key environment */}
        <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded text-[11px] text-emerald-900 leading-relaxed max-w-2xl">
          <span className="font-bold">Static demo scanner:</span> This playground runs the Premortem static demo analyzer against pasted code. It is not repository-aware. Full orchestrator audits run from Projects or Audits tabs.
        </div>
        <div className="mt-4">
          <OsStepper steps={scanSteps} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Side: Code Editor pasting console */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs">
            <label className="block font-mono font-bold uppercase tracking-wider text-[#717A75]">
              Source Script Input Console
            </label>
            
            {/* Quick Templates picker */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#8A958F]">Templates:</span>
              <div className="flex gap-1.5">
                {templates.map((temp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCode(temp.code)}
                    className="p-1 px-2 border border-[#EAE6DF] rounded bg-[#FAF8F5] text-[10px] text-neutral-700 hover:border-emerald-950 hover:bg-white transition-all cursor-pointer font-semibold"
                  >
                    Preset {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 rounded overflow-hidden shadow-sm border border-neutral-800">
            <div className="p-2 border-b border-neutral-800 bg-neutral-950/80 flex justify-between items-center font-mono text-[10px] text-zinc-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"/>
                <span className="font-bold text-[#A6BCB4]">live_buffer_compiler.ts</span>
              </div>
              <span>UTF-8 TS Code</span>
            </div>
            
            <textarea
              rows={16}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full p-4 font-mono text-xs bg-neutral-950 text-[#F5F4F0] focus:outline-none focus:border-indigo-600 border-none leading-relaxed resize-none h-[380px]"
              placeholder="// Write or paste server files, controllers, or database models here..."
            />
          </div>

          <button
            onClick={handleScan}
            disabled={isLoading || !code.trim()}
            className="w-full py-3 bg-emerald-950 text-white rounded font-semibold text-xs hover:bg-emerald-900 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Running static pattern scan…</span>
              </>
            ) : (
              <>
                <Play size={13} className="fill-current" />
                <span>Run static pattern scan</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: static scan results */}
        <div className="space-y-4">
          <label className="block font-mono font-bold uppercase tracking-wider text-[#717A75] text-xs">
            Static scan results (playground only)
          </label>

          {isLoading ? (
            <div className="border border-[#EAE6DF] rounded bg-[#FAF8F5] p-12 text-center flex flex-col items-center justify-center h-[420px] gap-3">
              <Sparkles size={24} className="text-emerald-800 animate-pulse" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-800">Applying static security rules…</p>
                <p className="text-[10px] text-[#5C6560] max-w-xs">
                  This playground does not call the orchestrator. Register a project for full AI audit findings.
                </p>
              </div>
            </div>
          ) : errorWord ? (
            <div className="border border-red-200 bg-red-50 p-6 rounded text-xs text-red-800 space-y-2 font-sans h-[420px] overflow-y-auto">
              <span className="font-bold flex items-center gap-1.5 uppercase text-[10px]">
                <Radio className="text-red-600 animate-pulse" size={12} />
                Static scan failed
              </span>
              <p className="leading-relaxed">
                {errorWord}
              </p>
            </div>
          ) : scanResult ? (
            <div className="border border-[#EAE6DF] bg-white rounded overflow-hidden flex flex-col h-[420px]">
              
              {/* Score header badge */}
              <div className="p-4 border-b border-[#EAE6DF] bg-[#FAF8F5] flex justify-between items-center text-xs">
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-neutral-400">COMPLIANCE INDEX</span>
                  <span className="text-base font-bold font-display text-zinc-900">{scanResult.score}% Compliant</span>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  scanResult.score >= 85 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {scanResult.score >= 85 ? 'PASSED' : 'VULNERABILITY WARNING'}
                </span>
              </div>

              {/* Finding items list overflow select to read */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {scanResult.findings.map((finding: Finding, idx: number) => (
                  <div key={idx} className="border border-[#EAE6DF] bg-[#FAF8F5]/50 rounded p-4 space-y-3 shrink-0">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="p-1 px-2 rounded-sm bg-rose-50 border border-rose-200 font-bold text-rose-800">
                        {finding.severity}
                      </span>
                      <span>Line :{finding.line} | Category: {finding.category}</span>
                    </div>

                    <h4 className="font-bold text-neutral-900 font-display text-sm mt-1">
                      {finding.title}
                    </h4>

                    <p className="text-xs text-[#5C6560] leading-relaxed select-text">
                      {finding.description}
                    </p>

                    {/* Trace step node in card */}
                    {finding.trace && finding.trace.length > 0 && (
                      <div className="pt-2 border-t border-[#EAE6DF] space-y-1">
                        <span className="block text-[9px] font-mono tracking-wider font-bold text-[#8A958F] uppercase">
                          Execution Path Node Traced
                        </span>
                        <div className="text-[11px] text-zinc-800 space-y-1 pl-2 border-l border-emerald-800 border-dashed">
                          {finding.trace.map((step, sIdx) => (
                            <div key={sIdx} className="flex gap-1.5 items-baseline">
                              <span className="font-bold font-mono text-emerald-900">{step.step}.</span>
                              <span className="leading-snug select-text">
                                <span className="font-bold underline uppercase text-[9px]">{step.location}</span>: {step.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendation */}
                    <div className="p-3 bg-white border border-[#EAE6DF] rounded text-[11px] space-y-1 font-sans">
                      <span className="block font-bold text-[#1E2522]">Resolution Guideline:</span>
                      <p className="text-[#5C6560] select-text">{finding.recommendation}</p>
                    </div>

                    {/* Code Suggested patch Diff */}
                    {finding.suggestedPatchCode && (
                      <div className="space-y-1.5 pt-2 border-t border-[#EAE6DF]">
                        <span className="block text-[9px] font-mono tracking-wider font-bold text-indigo-800 uppercase flex items-center gap-1">
                          <Wrench size={10} />
                          Automated Hotfix patch:
                        </span>
                        <pre className="p-2.5 bg-neutral-950 text-neutral-300 rounded font-mono text-[10px] overflow-x-auto max-h-[140px] leading-relaxed">
                          {finding.suggestedPatchCode}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-[#EAE6DF] border-dashed rounded p-12 text-center flex flex-col items-center justify-center text-xs text-[#5C6560] h-[420px] gap-3">
              <Terminal size={24} className="text-[#8A958F] animate-pulse" />
              <div className="space-y-1 max-w-xs">
                <p className="font-bold text-zinc-800">Playground Buffer Empty</p>
                <p className="text-[10px] text-zinc-400">
                  Select a template presets or paste custom files and click analyze to start a real-time live security run.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
