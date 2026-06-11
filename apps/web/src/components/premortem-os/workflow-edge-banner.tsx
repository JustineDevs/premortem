'use client';

import React from 'react';

import type { CanvasEdge } from './workflow-canvas.types';

interface WorkflowEdgeBannerProps {
  edge: CanvasEdge;
}

export function WorkflowEdgeBanner({ edge }: WorkflowEdgeBannerProps) {
  return (
    <div className="z-20 flex shrink-0 animate-fadeIn items-center justify-between border-t border-emerald-900 bg-emerald-950 p-3 px-6 font-mono text-xs text-[#FAF8F5]">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Path translator</span>
        <span className="font-bold text-white">
          {edge.from} → {edge.to}
        </span>
        <span className="text-emerald-300">({edge.label})</span>
      </div>
      <p className="max-w-xl text-right text-[11px] text-emerald-200">{edge.transformationDetail}</p>
    </div>
  );
}
