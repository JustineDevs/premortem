'use client';

import {
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { Check, ChevronDown, Search, Server, Sparkles, Cpu } from 'lucide-react';
import { ProviderIcon } from './ProviderIcon';
import { cn } from '@/lib/utils';

export interface ModelSelectorOption {
  kind: 'cloud' | 'local';
  value: string;
  label: string;
  description: string;
  iconSlug?: string;
  badge?: string;
  disabled?: boolean;
}

export interface ModelSelectorGroup {
  id: string;
  label: string;
  description?: string;
  options: ModelSelectorOption[];
}

interface ModelSelectorProps {
  id?: string;
  groups: ModelSelectorGroup[];
  selectedKey: string;
  triggerLabel: string;
  triggerDescription: string;
  triggerHelper?: string;
  onSelect: (option: ModelSelectorOption) => void;
  disabled?: boolean;
  className?: string;
}

function optionKey(option: ModelSelectorOption) {
  return `${option.kind}:${option.value}`;
}

function optionMatches(option: ModelSelectorOption, query: string) {
  if (!query.trim()) return true;
  const haystack = [
    option.label,
    option.description,
    option.value,
    option.badge ?? '',
    option.kind,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function ModelOptionIcon({ option }: { option: ModelSelectorOption }) {
  if (option.kind === 'local') {
    return option.iconSlug ? (
      <ProviderIcon slug={option.iconSlug} className="h-4 w-4" />
    ) : (
      <Server className="h-4 w-4 text-[#5C6560]" />
    );
  }

  return <Sparkles className="h-4 w-4 text-emerald-800" />;
}

export function ModelSelector({
  id,
  groups,
  selectedKey,
  triggerLabel,
  triggerDescription,
  triggerHelper,
  onSelect,
  disabled = false,
  className,
}: ModelSelectorProps) {
  const dialogId = useId();
  const inputId = id ?? dialogId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const allOptions = useMemo(
    () => groups.flatMap((group) => group.options),
    [groups],
  );

  const selectedOption =
    allOptions.find((option) => optionKey(option) === selectedKey) ??
    allOptions[0] ??
    null;

  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => optionMatches(option, query)),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  const filteredOptions = useMemo(
    () => filteredGroups.flatMap((group) => group.options),
    [filteredGroups],
  );

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex((current) =>
      Math.min(current, Math.max(filteredOptions.length - 1, 0)),
    );
  }, [filteredOptions.length, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (filteredOptions.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % filteredOptions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) =>
          (current - 1 + filteredOptions.length) % filteredOptions.length,
        );
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const option = filteredOptions[activeIndex];
        if (option && !option.disabled) {
          onSelect(option);
          setOpen(false);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, filteredOptions, onSelect, open]);

  useEffect(() => {
    if (!open) return;
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  }, [inputId, open]);

  const handleSelect = (option: ModelSelectorOption) => {
    if (option.disabled) return;
    onSelect(option);
    setOpen(false);
  };

  const highlight = filteredOptions[activeIndex] ?? null;

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setQuery('');
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'group flex h-[72px] w-full items-stretch rounded border border-[#EAE6DF] bg-white px-3 text-left shadow-sm transition-all',
          'hover:border-emerald-200 hover:bg-[#FCFBF8] focus:outline-none focus:ring-2 focus:ring-emerald-950/20',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <div className="flex w-full items-center gap-3 py-1.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100">
            {selectedOption?.kind === 'local' ? (
              selectedOption.iconSlug ? (
                <ProviderIcon slug={selectedOption.iconSlug} className="h-5 w-5" />
              ) : (
                <Cpu className="h-5 w-5" />
              )
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#717A75]">
              {triggerLabel}
            </p>
            <p className="mt-0.5 truncate text-[13px] font-bold text-[#1E2522]">
              {selectedOption?.label ?? triggerDescription}
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-[#5C6560]">
              {selectedOption?.description ?? triggerDescription}
            </p>
            {triggerHelper ? (
              <p className="mt-1 truncate text-[10px] text-[#8A958F]">
                {triggerHelper}
              </p>
            ) : null}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#8A958F]" />
        </div>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-[#111513]/50 px-4 py-6 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Model selector"
        >
          <div
            className="flex max-h-[calc(100dvh-3rem)] w-full max-w-[56rem] flex-col overflow-hidden rounded-2xl border border-[#EAE6DF] bg-white shadow-2xl"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setOpen(false);
              }
            }}
          >
            <div className="sticky top-0 z-10 border-b border-[#EAE6DF] bg-[#FAF8F5] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]">
                    Model selector
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[#1E2522]">
                    Choose the active workspace model
                  </h3>
                  <p className="mt-1 text-sm text-[#5C6560]">
                    Searchable cloud and local provider picker for switching
                    the active route without losing access to either pool.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-[#5C6560] shadow-none transition-colors hover:bg-white hover:text-[#1E2522] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                  aria-label="Close model selector"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
              <label
                htmlFor={inputId}
                className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-[#EAE6DF] bg-white px-3 text-[#1E2522] shadow-sm"
              >
                <Search className="h-4 w-4 shrink-0 text-[#8A958F]" />
                <input
                  id={inputId}
                  type="text"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search cloud models or local providers"
                  className="w-full border-0 bg-transparent text-sm outline-none ring-0 placeholder:text-[#8A958F] focus:border-0 focus:outline-none focus:ring-0"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              {filteredGroups.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-[#EAE6DF] bg-[#FAF8F5] px-6 py-10 text-center">
                  <p className="text-sm font-bold text-[#1E2522]">No matching models</p>
                  <p className="mt-1 text-sm text-[#5C6560]">
                    Try a cloud model name like Gemini or a local provider name.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredGroups.map((group) => (
                    <section key={group.id} className="space-y-2.5">
                      <div className="px-3">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#717A75]">
                          {group.label}
                        </p>
                        {group.description ? (
                          <p className="mt-1 text-sm text-[#5C6560]">
                            {group.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        {group.options.map((option) => {
                          const isActive =
                            optionKey(option) ===
                            (highlight ? optionKey(highlight) : selectedKey);
                          const isSelected = optionKey(option) === selectedKey;
                          return (
                            <button
                              key={optionKey(option)}
                              type="button"
                              disabled={option.disabled}
                              onClick={() => handleSelect(option)}
                              onMouseEnter={() => {
                                const index = filteredOptions.findIndex(
                                  (entry) => optionKey(entry) === optionKey(option),
                                );
                                if (index >= 0) {
                                  setActiveIndex(index);
                                }
                              }}
                              className={cn(
                                'group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all',
                                'border border-transparent hover:border-emerald-100 hover:bg-[#FCFBF8]',
                                'focus:outline-none focus:ring-2 focus:ring-emerald-950/15',
                                option.disabled && 'cursor-not-allowed opacity-45',
                                isActive && 'border-emerald-200 bg-emerald-50/60',
                              )}
                            >
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#EAE6DF]">
                                <ModelOptionIcon option={option} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-[#1E2522]">
                                      {option.label}
                                    </p>
                                    <p className="mt-1 text-sm leading-5 text-[#5C6560]">
                                      {option.description}
                                    </p>
                                  </div>
                                  {option.badge ? (
                                    <span className="shrink-0 rounded-full border border-[#EAE6DF] bg-white px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#717A75]">
                                      {option.badge}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#EAE6DF] bg-white">
                                {isSelected ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-900" />
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
