'use client';

import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type SwarmAgentNodeData = {
  label: string;
  status: string;
  lane: 'structure' | 'runtime';
  tokenCount?: number | null;
  badge: string;
  isSelected?: boolean;
};

export type SwarmAgentFlowNode = Node<SwarmAgentNodeData, 'swarmAgentStep'>;

function SwarmAgentNodeComponent({ data, selected }: NodeProps<SwarmAgentFlowNode>) {
  const isRunning = data.status === 'running';
  const isComplete = data.status === 'completed' || data.status === 'published';

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-[#8A958F] !bg-white"
      />
      <div
        className={`w-[11.5rem] rounded-xl border p-3 text-[10px] shadow-sm transition-all ${
          selected || data.isSelected
            ? 'border-emerald-950 bg-white ring-2 ring-emerald-950 ring-offset-2'
            : 'border-[#EAE6DF] bg-white/95'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.24em] text-[#8A958F]">
            {data.badge}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[7.5px] font-bold uppercase ${
              isComplete
                ? 'bg-emerald-50 text-emerald-800'
                : isRunning
                  ? 'bg-amber-50 text-amber-700 motion-safe:animate-pulse'
                  : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            {data.status}
          </span>
        </div>
        <h4 className="mt-2 truncate font-semibold text-[#1E2522]">{data.label}</h4>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#EAE6DF] pt-2 font-mono text-[8px] uppercase tracking-[0.2em] text-[#5C6560]">
          <span>{data.lane}</span>
          <span>{data.tokenCount == null ? 'tokens pending' : `${data.tokenCount} tokens`}</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-[#8A958F] !bg-white"
      />
    </>
  );
}

export const SwarmAgentNode = memo(SwarmAgentNodeComponent);

export const swarmNodeTypes = {
  swarmAgentStep: SwarmAgentNode
};

