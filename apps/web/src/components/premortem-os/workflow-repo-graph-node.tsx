'use client';

import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type RepoGraphNodeData = {
  label: string;
  type: string;
  color: string;
  lane?: 'structure' | 'runtime' | 'pipeline';
};

export type RepoGraphFlowNode = Node<RepoGraphNodeData, 'repoGraph'>;

function RepoGraphNodeComponent({ data, selected }: NodeProps<RepoGraphFlowNode>) {
  return (
    <>
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !opacity-0" />
      <div
        className={`flex max-w-[108px] flex-col items-center gap-1 px-1 py-1 transition-transform ${
          selected ? 'scale-105' : ''
        }`}
      >
        <span
          className={`rounded-full border-2 shadow-sm ${
            selected ? 'border-[#1E2522] ring-2 ring-emerald-950/15' : 'border-white'
          }`}
          style={{
            backgroundColor: data.color,
            width: data.type === 'repo' ? 28 : 20,
            height: data.type === 'repo' ? 28 : 20
          }}
          aria-hidden
        />
        <span className="line-clamp-2 text-center font-mono text-[8px] font-bold leading-tight text-[#1E2522]">
          {data.label}
        </span>
        <span className="truncate font-mono text-[7px] uppercase tracking-wide text-[#8A958F]">
          {data.type}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !opacity-0" />
    </>
  );
}

export const RepoGraphNode = memo(RepoGraphNodeComponent);

export const repoGraphNodeTypes = {
  repoGraph: RepoGraphNode
};

export const REPO_GRAPH_NODE_WIDTH = 96;
export const REPO_GRAPH_NODE_HEIGHT = 64;
