'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AuditRun, Finding, SeverityType } from "@/lib/premortem-os/types";
import {
  History,
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Layers,
  RotateCw,
  Flame,
  Search,
  AlertTriangle,
  ArrowUpRight,
  Info,
  Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { OsChartTooltip } from "./chart-tooltip";
import { OsToast } from "./os-toast";

const traceHref = (auditId: string) =>
  `/app?tab=audits&audit=${encodeURIComponent(auditId)}`;
const COMPARISON_RUN_A_ID = 'audit-history-comparison-run-a';
const COMPARISON_RUN_B_ID = 'audit-history-comparison-run-b';

function getSeverityStyle(severity: SeverityType) {
  switch (severity) {
    case "CRITICAL":
      return "bg-rose-50 text-rose-800 border-rose-200";
    case "HIGH":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "MEDIUM":
      return "bg-indigo-50 text-indigo-800 border-indigo-200";
    default:
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
}

interface AuditHistoryViewProps {
  audits: AuditRun[];
  onFetchAuditDetail: (auditId: string) => Promise<AuditRun | null>;
  onSelectAudit: (auditId: string) => void;
  setActiveTab: (tab: string) => void;
}

export function AuditHistoryView({
  audits,
  onFetchAuditDetail,
  onSelectAudit,
  setActiveTab,
}: AuditHistoryViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [comparisonRunAId, setComparisonRunAId] = useState<string>("");
  const [comparisonRunBId, setComparisonRunBId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [comparisonAudits, setComparisonAudits] = useState<{
    runA?: AuditRun;
    runB?: AuditRun;
  }>({});
  const [isComparing, setIsComparing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const chartViewportRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const viewport = chartViewportRef.current;
    if (!viewport) return;

    const updateWidth = () => {
      setChartWidth(Math.floor(viewport.getBoundingClientRect().width));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [selectedProjectId, audits.length]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3050);
  };
  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    },
    []
  );

  // Filter historical audits based on project selection & search term.
  const filteredAudits = useMemo(
    () =>
      audits.filter((a) => {
        const matchesProj =
          selectedProjectId === "ALL" || a.projectId === selectedProjectId;
        const matchesSearch =
          a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.id.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesProj && matchesSearch;
      }),
    [audits, selectedProjectId, searchTerm]
  );

  // Sort chronologically for timeline charts (oldest to newest).
  const chartData = useMemo(
    () =>
      [...audits]
        .filter((a) => selectedProjectId === "ALL" || a.projectId === selectedProjectId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((a) => ({
          date: new Date(a.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
          }),
          score: a.score,
          projectName: a.projectName,
          risks: a.findings?.length || 0
        })),
    [audits, selectedProjectId]
  );

  // Unique projects list for dropdown filtering.
  const projectsList = useMemo(() => {
    const uniqueProjectsMap = new Map<string, string>();
    audits.forEach((a) => {
      uniqueProjectsMap.set(a.projectId, a.projectName);
    });
    return Array.from(uniqueProjectsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [audits]);

  // Run comparative audit calculations.
  const runA = useMemo(
    () => comparisonAudits.runA ?? audits.find((a) => a.id === comparisonRunAId),
    [comparisonAudits.runA, audits, comparisonRunAId]
  );
  const runB = useMemo(
    () => comparisonAudits.runB ?? audits.find((a) => a.id === comparisonRunBId),
    [comparisonAudits.runB, audits, comparisonRunBId]
  );
  const comparisonResults = useMemo(() => {
    if (!runA || !runB) return null;

    // Sort chronologically: determine older run vs newer run.
    const timeA = new Date(runA.date).getTime();
    const timeB = new Date(runB.date).getTime();
    const olderRun = timeA <= timeB ? runA : runB;
    const newerRun = timeA > timeB ? runA : runB;

    const scoreDelta = newerRun.score - olderRun.score;
    const oldFindings = olderRun.findings || [];
    const newFindings = newerRun.findings || [];

    // Find "Secured" findings (exist in old, but marked RESOLVED or absent in new).
    const securedVulnerabilities = oldFindings.filter((oldF) => {
      const matchInNew = newFindings.find(
        (newF) => newF.title === oldF.title && newF.filepath === oldF.filepath
      );
      return !matchInNew || matchInNew.status === "RESOLVED";
    });

    // Find "New" findings introduced in the newer run.
    const newVulnerabilitiesIntroduced = newFindings.filter((newF) => {
      if (newF.status === "RESOLVED" || newF.status === "DISMISSED") return false;
      const existedInOld = oldFindings.find(
        (oldF) => oldF.title === newF.title && oldF.filepath === newF.filepath
      );
      return !existedInOld || existedInOld.status === "RESOLVED";
    });

    return {
      olderRun,
      newerRun,
      scoreDelta,
      securedVulnerabilities,
      newVulnerabilitiesIntroduced,
      oldCritical: olderRun.criticalCount || 0,
      newCritical: newerRun.criticalCount || 0,
      oldHigh: olderRun.highCount || 0,
      newHigh: newerRun.highCount || 0,
      oldMedium: olderRun.mediumCount || 0,
      newMedium: newerRun.mediumCount || 0
    };
  }, [runA, runB]);

  const exportHistoryCsv = () => {
    const header = ["id", "project", "date", "score", "critical", "high", "medium", "low"];
    const rows = filteredAudits.map((a) => [
      a.id,
      a.projectName,
      new Date(a.date).toISOString(),
      String(a.score),
      String(a.criticalCount ?? 0),
      String(a.highCount ?? 0),
      String(a.mediumCount ?? 0),
      String(a.lowCount ?? 0)
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `premortem-audit-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Audit history exported as CSV.");
  };

  const triggerComparison = async () => {
    if (!comparisonRunAId || !comparisonRunBId) {
      showToast(
        "Error: Please select two different audit target records to start comparison.",
      );
      return;
    }
    if (comparisonRunAId === comparisonRunBId) {
      showToast(
        "Error: Comparison targets must represent distinct historical audit milestones.",
      );
      return;
    }

    setIsComparing(true);
    try {
      const [hydratedA, hydratedB] = await Promise.all([
        onFetchAuditDetail(comparisonRunAId),
        onFetchAuditDetail(comparisonRunBId),
      ]);
      setComparisonAudits({
        runA: hydratedA ?? undefined,
        runB: hydratedB ?? undefined,
      });
      setShowComparison(true);
      showToast("Loaded runtime snapshots for comparative trace.");
    } catch {
      showToast("Failed to load audit snapshots for comparison.");
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div
      className="flex-1 overflow-y-auto p-8 font-sans space-y-8 max-w-7xl mx-auto w-full"
      id="audit-history-dashboard"
    >
      {/* Page Title & Backlinks */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#EAE6DF] pb-5 gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-mono text-[#8A958F] font-bold block">
            Audit History
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1E2522] font-display mt-1">
            Audit History & Comparison
          </h2>
          <p className="text-xs text-[#5C6560] mt-1 font-sans">
            Compare checkpointed audit runs, trace lineage changes, and review
            outcome trends across time.
          </p>
        </div>

        {/* Global project filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-[10px] uppercase font-bold text-zinc-500">
            Milestones Filter:
          </span>
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setShowComparison(false);
              showToast(
                `Timeline filter matched: ${e.target.value === "ALL" ? "All projects" : "Filtered project assets"}`,
              );
            }}
            className="p-1 px-3 border border-[#EAE6DF] bg-white rounded font-display focus:outline-none focus:border-emerald-950 font-bold text-xs"
          >
            <option value="ALL">All Workspace Projects</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* RECHARTS SCORE PROGRESSION TIMELINE */}
      {chartData.length > 0 && (
        <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b">
            <div>
              <h3 className="text-xs font-bold font-mono uppercase text-[#1C1D1B] tracking-wider">
                Audit outcome timeline
              </h3>
              <p className="text-[10.5px] text-[#717A75] mt-0.5">
                Structured run scores plotted across successive audit
                checkpoints.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportHistoryCsv}
                className="flex cursor-pointer items-center gap-1 rounded border border-[#EAE6DF] bg-white px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#5C6560] hover:border-[#8A958F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-950"
              >
                <Download size={11} aria-hidden />
                Export CSV
              </button>
              <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-mono font-bold bg-emerald-50 border border-emerald-100 p-1 px-2.5 rounded">
                <TrendingUp size={12} />
                <span>Continuous checks enabled</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pb-1 text-[10px] font-mono text-[#5C6560]">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 bg-[#064E3B]"
                aria-hidden
              />
              Compliance Rating (0–100)
            </span>
          </div>

          <div
            ref={chartViewportRef}
            className="relative z-10 h-60 w-full pt-4"
          >
            {chartWidth > 0 ? (
              <ResponsiveContainer width={chartWidth} height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE9" />
                  <XAxis
                    dataKey="date"
                    stroke="#5C6560"
                    tick={{ fill: "#5C6560", fontSize: 10 }}
                    fontSize={10}
                    fontFamily="JetBrains Mono, monospace"
                  />
                  <YAxis
                    stroke="#5C6560"
                    tick={{ fill: "#5C6560", fontSize: 10 }}
                    fontSize={10}
                    fontFamily="JetBrains Mono, monospace"
                    domain={[0, 100]}
                  />
                  <Tooltip
                    content={<OsChartTooltip />}
                    wrapperStyle={{ zIndex: 50, outline: "none" }}
                    cursor={{
                      stroke: "#064E3B",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#064E3B"
                    strokeWidth={2.5}
                    activeDot={{
                      r: 6,
                      fill: "#064E3B",
                      stroke: "#FAF8F5",
                      strokeWidth: 2,
                    }}
                    name="Compliance Rating"
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    formatter={() => (
                      <span className="text-[10px] font-mono text-[#5C6560]">
                        Compliance Rating
                      </span>
                    )}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded border border-dashed border-[#EAE6DF] bg-white/60 text-[10px] font-mono text-[#717A75]">
                Waiting for chart layout
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTERACTIVE DOCK FOR SELECTING COMPARING RUNS */}
      <div className="p-6 bg-white border border-[#EAE6DF] rounded-lg space-y-6">
        <div>
          <h3 className="text-xs font-bold font-mono uppercase text-[#1C1D1B] tracking-wider flex items-center gap-1.5">
            <Layers size={13} strokeWidth={2.5} className="text-emerald-900" />
            Milestones Audit Comparison Engine
          </h3>
          <p className="text-[10.5px] text-[#717A75] mt-0.5">
            Evaluate score deltas, address resolved security items (secured),
            and detect if new vulnerabilities have been introduced between
            separate runs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end text-xs">
          <div className="space-y-1.5">
            <label
              htmlFor={COMPARISON_RUN_A_ID}
              className="block font-mono font-bold text-zinc-500 uppercase text-[9px] tracking-wider"
            >
              1. Base Audit Baseline Record
            </label>
            <select
              id={COMPARISON_RUN_A_ID}
              value={comparisonRunAId}
              onChange={(e) => {
                setComparisonRunAId(e.target.value);
                setShowComparison(false);
              }}
              className="w-full p-2.5 bg-[#FAF8F5] border border-[#EAE6DF] rounded text-zinc-800 font-semibold focus:outline-none"
            >
              <option value="">Select Audit Run (A)</option>
              {audits.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.projectName}] - Score: {a.score} | (
                  {new Date(a.date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={COMPARISON_RUN_B_ID}
              className="block font-mono font-bold text-zinc-500 uppercase text-[9px] tracking-wider"
            >
              2. Target / Succeeding Audit Milestone
            </label>
            <select
              id={COMPARISON_RUN_B_ID}
              value={comparisonRunBId}
              onChange={(e) => {
                setComparisonRunBId(e.target.value);
                setShowComparison(false);
              }}
              className="w-full p-2.5 bg-[#FAF8F5] border border-[#EAE6DF] rounded text-zinc-800 font-semibold focus:outline-none"
            >
              <option value="">Select Audit Run (B)</option>
              {audits.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.projectName}] - Score: {a.score} | (
                  {new Date(a.date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={() => void triggerComparison()}
              disabled={isComparing}
              className="w-full p-2.5 text-center bg-emerald-950 font-bold hover:bg-emerald-900 text-[#FAF8F5] rounded transition-all cursor-pointer uppercase font-mono tracking-wider text-[11px] h-[38px] flex items-center justify-center gap-2 select-none disabled:opacity-50"
            >
              <RotateCw
                size={12}
                className={`shrink-0 ${isComparing ? "animate-spin" : ""}`}
              />
              <span>
                {isComparing
                  ? "Loading Snapshots…"
                  : "Execute Comparative Trace"}
              </span>
            </button>
          </div>
        </div>

        {/* COMPARATIVE RESULTS CANVAS */}
        {showComparison && comparisonResults && (
          <div className="border border-[#EAE6DF] rounded-lg bg-[#FAF8F5]/30 overflow-hidden animate-fadeIn space-y-6 p-6">
            {/* Headers row comparison summary info */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-5 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-[#8A958F] font-bold uppercase tracking-wider block">
                  COMPARE PATH:
                </span>
                <div className="text-xs font-mono font-bold inline-flex items-center gap-2">
                  <span className="text-zinc-600 font-bold">
                    {comparisonResults.olderRun.id} (
                    {new Date(
                      comparisonResults.olderRun.date,
                    ).toLocaleDateString()}
                    )
                  </span>
                  <ArrowRight size={13} className="text-zinc-400" />
                  <span className="text-emerald-900 font-bold">
                    {comparisonResults.newerRun.id} (
                    {new Date(
                      comparisonResults.newerRun.date,
                    ).toLocaleDateString()}
                    )
                  </span>
                </div>
              </div>

              {/* Score delta box */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-500 font-sans">
                  Compliance Index Shift:
                </span>
                <div
                  className={`p-2 px-3 rounded font-mono font-bold text-sm tracking-tight flex items-center gap-1.5 ${
                    comparisonResults.scoreDelta >= 0
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border border-rose-200 text-rose-800"
                  }`}
                >
                  {comparisonResults.scoreDelta >= 0 ? "+" : ""}
                  {comparisonResults.scoreDelta}%
                  {comparisonResults.scoreDelta >= 0 ? (
                    <TrendingUp size={16} />
                  ) : (
                    <TrendingDown size={16} />
                  )}
                </div>
              </div>
            </div>

            {/* Severity difference comparisons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="border bg-white p-3 rounded flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-[#8A958F] block font-bold uppercase">
                    CRITICAL ALARMS
                  </span>
                  <span className="font-bold text-zinc-900">
                    {comparisonResults.oldCritical} →{" "}
                    {comparisonResults.newCritical} instances
                  </span>
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${comparisonResults.newCritical <= comparisonResults.oldCritical ? "bg-emerald-500" : "bg-red-500"}`}
                />
              </div>

              <div className="border bg-white p-3 rounded flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-[#8A958F] block font-bold uppercase">
                    HIGH THREATS
                  </span>
                  <span className="font-bold text-zinc-900">
                    {comparisonResults.oldHigh} → {comparisonResults.newHigh}{" "}
                    instances
                  </span>
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${comparisonResults.newHigh <= comparisonResults.oldHigh ? "bg-emerald-500" : "bg-red-500"}`}
                />
              </div>

              <div className="border bg-white p-3 rounded flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-[#8A958F] block font-bold uppercase">
                    MEDIUM RISK VALUES
                  </span>
                  <span className="font-bold text-zinc-900">
                    {comparisonResults.oldMedium} →{" "}
                    {comparisonResults.newMedium} instances
                  </span>
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${comparisonResults.newMedium <= comparisonResults.oldMedium ? "bg-emerald-500" : "bg-red-500"}`}
                />
              </div>
            </div>

            {/* Lists of Adressed (Secured) vs Introduced Risks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start text-xs">
              {/* Box A: SECURED ADDRESSMENTS */}
              <div className="border border-emerald-200 bg-emerald-50/5 rounded-lg overflow-hidden flex flex-col h-full min-h-[300px]">
                <div className="p-4 bg-emerald-950 text-white font-mono flex items-center justify-between shrink-0 font-bold uppercase text-[9.5px]">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-[#72C8AF]" /> SECURED
                    VULNERABILITIES (
                    {comparisonResults.securedVulnerabilities.length})
                  </span>
                  <span className="bg-emerald-900 border border-emerald-800 text-[8.5px] px-1.5 py-0.2 rounded text-emerald-300 font-bold">
                    REMEDIATED SUCCESS
                  </span>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {comparisonResults.securedVulnerabilities.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-8 text-center text-zinc-400 italic leading-relaxed">
                      No previously open threats have been addressed or resolved
                      yet. Click Audits to deploy standard secure patches.
                    </div>
                  ) : (
                    comparisonResults.securedVulnerabilities.map((v, idx) => (
                      <div
                        key={v.id}
                        className="border border-emerald-100 bg-white p-3.5 rounded shadow-xs space-y-1.5 relative overflow-hidden group"
                      >
                        <div className="flex justify-between items-center font-mono text-[9px]">
                          <span
                            className={`${getSeverityStyle(v.severity)} font-bold px-1.5 border py-0.2 rounded`}
                          >
                            {v.severity}
                          </span>
                          <span className="text-zinc-400 select-text bg-zinc-50 border px-1 rounded">
                            {v.filepath}:{v.line}
                          </span>
                        </div>
                        <h4 className="font-semibold text-neutral-800 font-display select-text">
                          {v.title}
                        </h4>
                        <p className="text-[10.5px] text-[#5C6560] leading-relaxed select-text">
                          {v.description}
                        </p>
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Box B: NEW INTRODCUTED THREATS */}
              <div className="border border-rose-200 bg-rose-50/5 rounded-lg overflow-hidden flex flex-col h-full min-h-[300px]">
                <div className="p-4 bg-rose-950 text-white font-mono flex items-center justify-between shrink-0 font-bold uppercase text-[9.5px]">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert
                      size={14}
                      className="text-rose-400 animate-pulse"
                    />{" "}
                    NEWLY DETECTED ALARMS (
                    {comparisonResults.newVulnerabilitiesIntroduced.length})
                  </span>
                  <span className="bg-rose-900 border border-rose-800 text-[8.5px] px-1.5 py-0.2 rounded text-rose-300 font-bold animate-pulse">
                    ATTENTION REQUIRED
                  </span>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {comparisonResults.newVulnerabilitiesIntroduced.length ===
                  0 ? (
                    <div className="h-full flex items-center justify-center p-8 text-center text-zinc-400 italic leading-relaxed">
                      Outstanding secure code branches! Zero new vulnerabilities
                      or security risks introduced in succession milestones.
                    </div>
                  ) : (
                    comparisonResults.newVulnerabilitiesIntroduced.map(
                      (v) => (
                        <div
                          key={v.id}
                          className="border border-rose-200 bg-white p-3.5 rounded shadow-xs space-y-1.5 relative overflow-hidden group"
                        >
                          <div className="flex justify-between items-center font-mono text-[9px]">
                            <span
                              className={`${getSeverityStyle(v.severity)} font-bold px-1.5 border py-0.2 rounded`}
                            >
                              {v.severity}
                            </span>
                            <span className="text-zinc-400 select-text bg-zinc-50 border px-1 rounded">
                              {v.filepath}:{v.line}
                            </span>
                          </div>
                          <h4 className="font-semibold text-neutral-800 font-display select-text">
                            {v.title}
                          </h4>
                          <p className="text-[10.5px] text-[#5C6560] leading-relaxed select-text">
                            {v.description}
                          </p>
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-600" />
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ALL HISTORIC RUNS CHRONOLOGICAL TIMELINE TABLE */}
      <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-xs font-bold font-mono uppercase text-[#1C1D1B] tracking-wider flex items-center gap-1.5">
            <History size={13} className="text-zinc-700" />
            Complete Historical Audit Log checklist
          </h3>
          <p className="text-[10.5px] text-[#717A75] mt-0.5">
            Check details or comparison options across the chronological
            sequence of continuous sweeps.
          </p>
        </div>

        <div className="relative overflow-x-auto border rounded bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EAE6DF] bg-[#FAF8F5] font-mono text-[10px] text-[#8A958F] uppercase">
                <th className="p-3">Reference Ref</th>
                <th className="p-3">Project Domain</th>
                <th className="p-3">Execution Millisecond Date</th>
                <th className="p-3 text-center">Calculated Index</th>
                <th className="p-3 text-center">Threats Discovered</th>
                <th className="p-3 text-right">Inspection Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6DF]/60">
              {filteredAudits.map((a) => {
                const totalRisks =
                  (a.criticalCount || 0) +
                  (a.highCount || 0) +
                  (a.mediumCount || 0) +
                  (a.lowCount || 0);
                const isSelectedForComp =
                  comparisonRunAId === a.id || comparisonRunBId === a.id;

                return (
                  <tr
                    key={a.id}
                    className={`hover:bg-[#FAF8F5]/30 transition-all ${isSelectedForComp ? "bg-slate-100/50" : ""}`}
                  >
                    <td className="p-3 font-mono font-bold text-slate-800">
                      {a.id}
                    </td>
                    <td className="p-3 font-semibold text-zinc-900 font-display">
                      {a.projectName}
                    </td>
                    <td className="p-3 text-zinc-500 font-mono text-[11px]">
                      {new Date(a.date).toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] ${
                          a.score >= 85
                            ? "bg-emerald-50 text-emerald-800"
                            : a.score >= 60
                              ? "bg-amber-50 text-amber-800"
                              : "bg-rose-50 text-rose-800"
                        }`}
                      >
                        {a.score}%
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-rose-600">
                      {totalRisks}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5 select-none">
                        <button
                          type="button"
                          onClick={() => {
                            if (!comparisonRunAId) {
                              setComparisonRunAId(a.id);
                              showToast(
                                `Set baseline benchmark run to A: "${a.id}"`,
                              );
                            } else if (
                              !comparisonRunBId &&
                              comparisonRunAId !== a.id
                            ) {
                              setComparisonRunBId(a.id);
                              showToast(
                                `Set comparison succeeding run to B: "${a.id}"`,
                              );
                            } else {
                              // Reset option
                              setComparisonRunAId(a.id);
                              setComparisonRunBId("");
                              setShowComparison(false);
                              showToast(
                                `Benchmark reset. baseline benchmark set to A: "${a.id}"`,
                              );
                            }
                          }}
                          className={`p-1 px-2 border text-[10px] rounded transition-all font-mono font-bold cursor-pointer uppercase ${
                            isSelectedForComp
                              ? "bg-emerald-950 border-emerald-950 text-white"
                              : "bg-white border-[#EAE6DF] text-zinc-600 hover:border-zinc-400"
                          }`}
                        >
                          {isSelectedForComp ? "Matched Comp" : "Audit Compare"}
                        </button>

                        <a
                          href={traceHref(a.id)}
                          className="p-1 px-2 bg-white border border-[#EAE6DF] hover:border-zinc-400 hover:bg-neutral-50 text-[10px] rounded transition-all inline-flex items-center gap-1 font-semibold text-zinc-800 cursor-pointer"
                        >
                          <span>Trace</span>
                          <ArrowUpRight size={11} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <OsToast message={toastMsg ?? ""} />
    </div>
  );
}
