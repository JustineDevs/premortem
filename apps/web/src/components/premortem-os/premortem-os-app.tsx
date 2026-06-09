'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { DashboardView } from './DashboardView';
import { ProjectsView } from './ProjectsView';
import { AuditsView } from './AuditsView';
import { AdHocSandboxView } from './AdHocSandboxView';
import { SettingsView } from './SettingsView';
import { WorkflowCanvasView } from './WorkflowCanvasView';
import { AuditHistoryView } from './AuditHistoryView';
import { Project, AuditRun, ProviderType, Finding } from '@/lib/premortem-os/types';
import { premortemBrand } from '@/lib/premortem-os/branding';
import { AlertCircle } from 'lucide-react';

import { OsLoadingScreen } from './os-loading-screen';

export function PremortemOsApp() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [audits, setAudits] = useState<AuditRun[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  
  // Loading and interaction states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPatching, setIsPatching] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute aggregate system compliance score based on recent audits
  const [systemScore, setSystemScore] = useState<number>(72);

  // 1. Load initial payload
  useEffect(() => {
    async function bootstrapWorkspace() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [projRes, audRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/audits')
        ]);

        if (!projRes.ok || !audRes.ok) {
          throw new Error("Failure loading security metrics from full-stack api.");
        }

        const projData = await projRes.json();
        const audData = await audRes.json();

        setProjects(projData);
        setAudits(audData);

        if (audData.length > 0) {
          setSelectedAuditId(audData[0].id);
          // Calculate average score of latest audits
          const avgScore = Math.round(audData.reduce((sum: number, current: any) => sum + current.score, 0) / audData.length);
          setSystemScore(avgScore);
        }
      } catch (err: any) {
        console.error("Bootstrap workspace failed:", err);
        setErrorMessage(err.message || "Failed to establish socket connection with backend server.");
      } finally {
        setIsLoading(false);
      }
    }

    bootstrapWorkspace();
  }, []);

  // 2. Refresh scores on audits change
  useEffect(() => {
    if (audits.length > 0) {
      const avgScore = Math.round(audits.reduce((sum, current) => sum + current.score, 0) / audits.length);
      setSystemScore(avgScore);
    }
  }, [audits]);

  // 3. Register a new repository asset
  const handleRegisterProject = async (newProjPayload: {
    name: string;
    repoUrl: string;
    branch: string;
    provider: ProviderType;
    scanCodeSnippet?: string;
  }) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProjPayload),
      });

      if (!res.ok) {
        throw new Error("Unable to register repository resource.");
      }

      const registered = await res.json();
      setProjects((prev) => [...prev, registered]);
    } catch (err: any) {
      alert("Error registering repository: " + err.message);
    }
  };

  // 4. Trigger active continuous run
  const handleTriggerScan = async (projectId: string) => {
    // Set matching project to scanning state
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: 'SCANNING' } : p))
    );
    
    // Auto-navigate to Audits list to observe progress
    setActiveTab('audits');

    try {
      const res = await fetch('/api/audits/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        throw new Error("Vulnerability scanner crash on live endpoint compile.");
      }

      const result = await res.json();
      if (result.success && result.audit) {
        const newAuditRecord: AuditRun = result.audit;
        setAudits((prev) => [newAuditRecord, ...prev]);
        setSelectedAuditId(newAuditRecord.id);

        // Update corresponding project status
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const auditFindings = newAuditRecord.findings || [];
              const severeCount = auditFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length;
              const hasWarnings = auditFindings.filter(f => f.severity === 'MEDIUM').length > 0;
              
              let status: 'COMPLIANT' | 'WARNING' | 'FAILED' = 'COMPLIANT';
              if (severeCount > 0) status = 'FAILED';
              else if (hasWarnings) status = 'WARNING';

              return {
                ...p,
                status,
                lastAuditScore: newAuditRecord.score,
                lastAuditDate: newAuditRecord.date,
              };
            }
            return p;
          })
        );
      }
    } catch (err: any) {
      alert("AI Security Scan Failed: " + err.message);
      // Reset scanning state back to normal warning level on exception
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: 'FAILED' } : p))
      );
    }
  };

  // 5. Update Finding action (confirm / dismiss false positives)
  const handleUpdateFindingStatus = async (
    auditId: string, 
    issueId: string, 
    action: 'CONFIRMED' | 'DISMISSED' | 'RESOLVED'
  ) => {
    try {
      const res = await fetch(`/api/audits/${auditId}/issues/${issueId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        throw new Error("Failed to change severity findings logs.");
      }

      const data = await res.json();
      if (data.success) {
        setAudits((prev) =>
          prev.map((audit) => {
            if (audit.id === auditId) {
              return {
                ...audit,
                findings: audit.findings.map((f) =>
                  f.id === issueId ? { ...f, status: action } : f
                ),
              };
            }
            return audit;
          })
        );
      }
    } catch (err: any) {
      alert("Unable to update finding state: " + err.message);
    }
  };

  // 5b. Synthesized issue update handler
  const handleUpdateFindingFields = (
    auditId: string,
    findingId: string,
    fields: Partial<Finding>
  ) => {
    setAudits((prev) =>
      prev.map((audit) => {
        if (audit.id === auditId) {
          return {
            ...audit,
            findings: audit.findings.map((f) =>
              f.id === findingId ? { ...f, ...fields } : f
            ),
          };
        }
        return audit;
      })
    );
  };

  // 6. Deploy Code Patch and create virtual PR
  const handleDeployPatch = async (auditId: string, issueId: string) => {
    setIsPatching(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/patch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ issueId }),
      });

      if (!res.ok) {
        throw new Error("Patch deployment request failure.");
      }

      const data = await res.json();
      if (data.success) {
        setAudits((prev) =>
          prev.map((audit) => {
            if (audit.id === auditId) {
              return {
                ...audit,
                score: data.auditScore,
                findings: audit.findings.map((f) =>
                  f.id === issueId ? { ...f, status: 'RESOLVED', patchApplied: true } : f
                ),
              };
            }
            return audit;
          })
        );

        // Update local projects table as well
        const targetAudit = audits.find(a => a.id === auditId);
        if (targetAudit) {
          setProjects(prev => prev.map(p => {
            if (p.id === targetAudit.projectId) {
              return {
                ...p,
                status: 'COMPLIANT',
                lastAuditScore: data.auditScore
              };
            }
            return p;
          }));
        }
      }
    } catch (err: any) {
      alert("Patch deployment failed during git push routing: " + err.message);
    } finally {
      setIsPatching(false);
    }
  };

  // 7. General Custom Snippets scanning inside Playground
  const handleAnalyzeSnippet = async (customSnippet: string) => {
    try {
      const res = await fetch('/api/audits/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customSnippet }),
      });
      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || "Unable to invoke security sandbox.");
      }
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Auditing exception." };
    }
  };

  if (isLoading) {
    return <OsLoadingScreen />;
  }

  // Error wrapper screen
  if (errorMessage) {
    return (
      <div className="w-screen h-screen bg-[#FBFBFA] flex items-center justify-center font-sans px-6">
        <div className="max-w-md p-6 border border-rose-200 bg-rose-50 text-xs rounded text-rose-800 space-y-4 shadow-sm">
          <div className="flex gap-2 items-center font-display font-semibold uppercase text-[10px] tracking-wider text-rose-800">
            <AlertCircle size={14} className="text-rose-600 animate-pulse" />
            <span>{premortemBrand.errorTitle}</span>
          </div>
          <p className="leading-relaxed">{errorMessage}</p>
          <div className="pt-2 border-t border-rose-100 flex gap-2 font-mono text-[9px]">
            <span>CODE: INTERFACE_CONNECT_TIMEOUT</span>
            <a
              href={`mailto:${premortemBrand.supportEmail}`}
              className="ml-auto text-zinc-500 hover:text-rose-900 underline-offset-2 hover:underline"
            >
              {premortemBrand.errorSupportLabel}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="layout-view" className="flex h-screen w-screen overflow-hidden bg-[#FBFBFA] text-[#1E2522]">
      {/* Primary Sidebar Left Menu Navigation Row */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        systemScore={systemScore} 
      />

      {/* Main View Work Content Panel */}
      <main id="workspace-main" className="flex-1 overflow-hidden flex flex-col h-full bg-[#FBFBFA]">
        {activeTab === 'dashboard' && (
          <DashboardView 
            projects={projects}
            audits={audits}
            onTriggerScan={handleTriggerScan}
            onSelectAudit={(auditId) => {
              setSelectedAuditId(auditId);
              setActiveTab('audits');
            }}
            systemScore={systemScore}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsView
            projects={projects}
            onTriggerScan={handleTriggerScan}
            onRegisterProject={handleRegisterProject}
          />
        )}

        {activeTab === 'audits' && (
          <AuditsView
            audits={audits}
            selectedAuditId={selectedAuditId}
            onSelectAudit={setSelectedAuditId}
            onUpdateFindingStatus={handleUpdateFindingStatus}
            onUpdateFindingFields={handleUpdateFindingFields}
            onDeployPatch={handleDeployPatch}
            isPatching={isPatching}
            onTriggerScan={handleTriggerScan}
          />
        )}

        {activeTab === 'sandbox' && (
          <AdHocSandboxView 
            onAnalyzeSnippet={handleAnalyzeSnippet}
          />
        )}

        {activeTab === 'canvas' && (
          <WorkflowCanvasView
            projects={projects}
            audits={audits}
            onTriggerScan={handleTriggerScan}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'history' && (
          <AuditHistoryView
            audits={audits}
            onSelectAudit={(auditId) => {
              setSelectedAuditId(auditId);
              setActiveTab('audits');
            }}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView />
        )}
      </main>
    </div>
  );
}
