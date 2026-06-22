'use client';

import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type PipelineStepNodeData = {
  label: string;
  description: string;
  status: string;
  meta?: string;
  icon: React.ReactNode;
  statusClassName: string;
  cardClassName: string;
};

export type PipelineStepFlowNode = Node<PipelineStepNodeData, 'pipelineStep'>;

function PipelineStepNodeComponent({ data, selected }: NodeProps<PipelineStepFlowNode>) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-[#8A958F] !bg-white"
      />
      <div
        className={`w-[13.75rem] rounded-lg border p-3 text-xs shadow-sm transition-shadow ${data.cardClassName} ${
          selected ? 'ring-2 ring-emerald-950 ring-offset-2 shadow-md' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="text-[8px] font-bold uppercase tracking-wider text-[#8A958F]">
            pipeline node
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[7.5px] font-bold uppercase ${data.statusClassName}`}
          >
            {data.status}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <div className="rounded border bg-white/70 p-[5px]">{data.icon}</div>
          <div className="min-w-0">
            <h4 className="truncate text-[13px] font-bold leading-tight text-[#1E2522]">{data.label}</h4>
            <p className="truncate text-[10px] leading-snug text-[#5C6560]">{data.description}</p>
          </div>
        </div>
        {data.meta ? (
          <p className="mt-2 truncate border-t border-[#EAE6DF]/70 pt-1 font-mono text-[9px] text-[#5C6560]">
            {data.meta}
          </p>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-[#8A958F] !bg-white"
      />
    </>
  );
}

export const PipelineStepNode = memo(PipelineStepNodeComponent);

export const pipelineNodeTypes = {
  pipelineStep: PipelineStepNode
};

export const PIPELINE_NODE_WIDTH = 220;
export const PIPELINE_NODE_HEIGHT = 92;
