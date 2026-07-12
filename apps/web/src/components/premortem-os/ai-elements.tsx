'use client';

import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Code2,
  FileCode,
  Layers,
  ListTodo,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Terminal,
  ClipboardList,
  Search
} from 'lucide-react';

import { cn } from '@/lib/utils';

type AiStatus = 'pending' | 'running' | 'completed' | 'failed' | 'approved' | 'blocked';

export interface AiSuggestionItem {
  label: string;
  detail?: string;
  onClick: () => void;
}

export interface AiConversationItem {
  role: 'user' | 'assistant' | 'tool';
  title: string;
  body: ReactNode;
  meta?: string;
}

export interface AiSourceItem {
  label: string;
  detail: string;
  href?: string;
}

export interface AiTaskItem {
  label: string;
  detail: string;
  state: AiStatus;
}

export interface AiToolItem {
  title: string;
  detail: string;
  state: AiStatus;
}

export interface AiCheckpointItem {
  phase: string;
  savedAt: string;
  summary: string;
}

export interface AiSchemaItem {
  method: string;
  endpoint: string;
  request: string;
  response: string;
}

export function AiSuggestionRow({
  items,
  className
}: {
  items: AiSuggestionItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className="inline-flex items-center gap-1.5 rounded-none border border-[#EAE6DF] bg-white px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#1E2522] transition-colors hover:border-emerald-300 hover:bg-emerald-50"
        >
          <Sparkles className="h-3 w-3 text-emerald-700" />
          <span>{item.label}</span>
          {item.detail ? <span className="text-[#8A958F] normal-case tracking-normal">{item.detail}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function AiAgentCard({
  name,
  model,
  description,
  tools
}: {
  name: string;
  model: string;
  description: string;
  tools: string[];
}) {
  return (
    <div className="rounded-lg border border-[#EAE6DF] bg-[#FAF8F5] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-950 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]">
              Agent
            </p>
            <h3 className="mt-1 text-sm font-bold text-[#1E2522]">{name}</h3>
            <p className="mt-1 text-xs text-[#5C6560]">{description}</p>
          </div>
        </div>
        <span className="inline-flex rounded border border-[#EAE6DF] bg-white px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#5C6560]">
          {model}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tools.map((tool) => (
          <span
            key={tool}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-900"
          >
            <ShieldCheck className="h-3 w-3" />
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AiConversationCard({
  items
}: {
  items: AiConversationItem[];
}) {
  return (
    <div className="rounded-lg border border-[#EAE6DF] bg-white">
      <div className="flex items-center justify-between border-b border-[#EAE6DF] bg-[#FAF8F5] px-4 py-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]">
            Conversation
          </p>
          <p className="mt-1 text-xs text-[#5C6560]">Prompt, model response, and tool notes.</p>
        </div>
        <MessageSquare className="h-4 w-4 text-[#8A958F]" />
      </div>
      <div className="space-y-3 p-4">
        {items.map((item) => (
          <div
            key={`${item.role}-${item.title}`}
            className={cn(
              'rounded-xl border p-3',
              item.role === 'assistant'
                ? 'border-emerald-200 bg-emerald-50/70'
                : item.role === 'tool'
                  ? 'border-sky-200 bg-sky-50/70'
                  : 'border-[#EAE6DF] bg-[#FAF8F5]'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#717A75]">
                {item.role}
              </p>
              {item.meta ? (
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#8A958F]">
                  {item.meta}
                </span>
              ) : null}
            </div>
            <h4 className="mt-1 text-sm font-bold text-[#1E2522]">{item.title}</h4>
            <div className="mt-2 text-xs leading-relaxed text-[#5C6560]">{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AiReasoningCard({
  title = 'Reasoning',
  summary,
  steps
}: {
  title?: string;
  summary: string;
  steps: string[];
}) {
  return (
    <div className="rounded-lg border border-[#EAE6DF] bg-[#FAF8F5] p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-700" />
        <h3 className="text-sm font-bold text-[#1E2522]">{title}</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#5C6560]">{summary}</p>
      <ol className="mt-3 space-y-2">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2 text-xs text-[#1E2522]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-950 font-mono text-[9px] font-bold text-white">
              {index + 1}
            </span>
            <span className="leading-relaxed text-[#5C6560]">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AiSourcesCard({
  items
}: {
  items: AiSourceItem[];
}) {
  return (
    <div className="rounded-lg border border-[#EAE6DF] bg-white">
      <div className="flex items-center gap-2 border-b border-[#EAE6DF] bg-[#FAF8F5] px-4 py-3">
        <Search className="h-4 w-4 text-[#8A958F]" />
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]">
            Sources
          </p>
          <p className="mt-1 text-xs text-[#5C6560]">Traceable evidence and lookup refs.</p>
        </div>
      </div>
      <div className="space-y-2 p-4">
        {items.map((item) => (
          <a
            key={`${item.label}-${item.detail}`}
            href={item.href ?? '#'}
            target={item.href ? '_blank' : undefined}
            rel={item.href ? 'noreferrer' : undefined}
            className="block rounded border border-[#EAE6DF] bg-[#FAF8F5] px-3 py-2 transition-colors hover:border-emerald-200 hover:bg-white"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-[#1E2522]">{item.label}</p>
              {item.href ? <ArrowUpRight className="h-3.5 w-3.5 text-[#8A958F]" /> : null}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#5C6560]">{item.detail}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

export function AiToolTimeline({
  items
}: {
  items: AiToolItem[];
}) {
  return (
    <div className="rounded-lg border border-[#EAE6DF] bg-[#FAF8F5] p-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[#8A958F]" />
        <h3 className="text-sm font-bold text-[#1E2522]">Tool calls</h3>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-3 rounded border border-[#EAE6DF] bg-white px-3 py-2">
            <span
              className={cn(
                'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-mono font-bold uppercase',
                item.state === 'completed'
                  ? 'bg-emerald-50 text-emerald-800'
                  : item.state === 'running'
                    ? 'bg-sky-50 text-sky-800'
                    : item.state === 'failed'
                      ? 'bg-rose-50 text-rose-800'
                      : item.state === 'approved'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-zinc-100 text-zinc-700'
              )}
            >
              {item.state === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1E2522]">{item.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#5C6560]">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AiTaskList({
  items
}: {
  items: AiTaskItem[];
}) {
  return (
    <div className="rounded-lg border border-[#EAE6DF] bg-[#FAF8F5] p-4">
      <div className="flex items-center gap-2">
        <ListTodo className="h-4 w-4 text-[#8A958F]" />
        <h3 className="text-sm font-bold text-[#1E2522]">Task progress</h3>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="rounded border border-[#EAE6DF] bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-[#1E2522]">{item.label}</p>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em]',
                  item.state === 'completed'
                    ? 'bg-emerald-50 text-emerald-800'
                    : item.state === 'running'
                      ? 'bg-sky-50 text-sky-800'
                      : item.state === 'failed'
                        ? 'bg-rose-50 text-rose-800'
                        : item.state === 'approved'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-zinc-100 text-zinc-700'
                )}
              >
                {item.state}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#5C6560]">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AiCheckpointCard({
  item
}: {
  item: AiCheckpointItem;
}) {
  return (
    <div className="rounded-lg border border-[#EAE6DF] bg-white p-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-[#8A958F]" />
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]">
            Checkpoint
          </p>
          <h3 className="mt-1 text-sm font-bold text-[#1E2522]">{item.phase}</h3>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#5C6560]">{item.summary}</p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#8A958F]">
        Saved {item.savedAt}
      </p>
    </div>
  );
}

export function AiSchemaDisplayCard({
  item
}: {
  item: AiSchemaItem;
}) {
  return (
    <div className="rounded-lg border border-[#EAE6DF] bg-white p-4">
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-[#8A958F]" />
        <h3 className="text-sm font-bold text-[#1E2522]">Schema display</h3>
      </div>
      <div className="mt-3 grid gap-3 text-xs">
        <div className="rounded border border-[#EAE6DF] bg-[#FAF8F5] p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#717A75]">
            Request
          </p>
          <p className="mt-1 font-mono text-[11px] text-[#1E2522]">
            {item.method} {item.endpoint}
          </p>
          <pre className="mt-2 overflow-x-auto font-mono text-[10px] leading-relaxed text-[#5C6560]">
            {item.request}
          </pre>
        </div>
        <div className="rounded border border-[#EAE6DF] bg-[#FAF8F5] p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#717A75]">
            Response
          </p>
          <pre className="mt-2 overflow-x-auto font-mono text-[10px] leading-relaxed text-[#5C6560]">
            {item.response}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function AiArtifactCard({
  title,
  description,
  content
}: {
  title: string;
  description: string;
  content: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#EAE6DF] bg-[#FAF8F5] p-4">
      <div className="flex items-center gap-2">
        <FileCode className="h-4 w-4 text-[#8A958F]" />
        <h3 className="text-sm font-bold text-[#1E2522]">{title}</h3>
      </div>
      <p className="mt-2 text-xs text-[#5C6560]">{description}</p>
      <div className="mt-3 rounded border border-[#EAE6DF] bg-white p-3 text-xs text-[#1E2522]">
        {content}
      </div>
    </div>
  );
}

export function AiTerminalCard({
  title = 'Terminal output',
  lines
}: {
  title?: string;
  lines: string[];
}) {
  return (
    <div className="rounded-lg border border-[#EAE6DF] bg-neutral-950 p-4 text-neutral-100">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      <pre className="mt-3 max-h-56 overflow-y-auto overflow-x-auto font-mono text-[10px] leading-relaxed text-neutral-300">
        {lines.map((line) => `> ${line}`).join('\n')}
      </pre>
    </div>
  );
}
