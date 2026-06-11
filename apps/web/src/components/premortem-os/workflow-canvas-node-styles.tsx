import React from 'react';
import { Activity, CloudLightning, Database, Layers, ThumbsUp } from 'lucide-react';

import type { CanvasNodeStatus, CanvasNodeType } from './workflow-canvas.types';

export function getNodeStyles(status: CanvasNodeStatus) {
  let cardClassName = 'border-[#EAE6DF] bg-white text-[#1E2522]';
  let iconColor = 'text-zinc-600';
  let statusClassName = 'bg-zinc-100 text-zinc-700';

  if (status === 'completed') {
    cardClassName = 'border-emerald-700/40 bg-[#FAF8F5] text-zinc-900';
    iconColor = 'text-emerald-800';
    statusClassName = 'bg-emerald-50 text-emerald-800 font-bold';
  } else if (status === 'running') {
    cardClassName = 'border-amber-500/60 bg-amber-50/40 motion-safe:animate-pulse';
    iconColor = 'text-amber-600';
    statusClassName = 'bg-amber-100 text-amber-800 font-bold';
  } else if (status === 'reviewable') {
    cardClassName = 'border-indigo-300 bg-[#FDFDFD] text-indigo-950';
    iconColor = 'text-indigo-600';
    statusClassName = 'bg-indigo-50 text-indigo-800 font-bold';
  } else if (status === 'published') {
    cardClassName = 'border-orange-400 bg-[#FAF8F5] text-orange-950';
    iconColor = 'text-orange-600';
    statusClassName = 'bg-orange-50 text-orange-800 font-bold';
  } else if (status === 'partial') {
    cardClassName = 'border-amber-600 bg-white border-2';
    iconColor = 'text-amber-700';
    statusClassName = 'bg-amber-50 text-amber-700 font-bold';
  } else if (status === 'failed') {
    cardClassName = 'border-rose-500 bg-rose-50/30 border-2';
    iconColor = 'text-rose-600';
    statusClassName = 'bg-rose-50 text-rose-700 font-bold';
  } else {
    cardClassName = 'border-[#EAE6DF] bg-white text-zinc-500';
    statusClassName = 'bg-zinc-100 text-zinc-600';
  }

  return { cardClassName, iconColor, statusClassName };
}

export function canvasNodeIcon(type: CanvasNodeType, iconColor: string) {
  const IconComp =
    type === 'input'
      ? Database
      : type === 'execution'
        ? Activity
        : type === 'synthesis'
          ? Layers
          : type === 'review'
            ? ThumbsUp
            : CloudLightning;
  return (
    <span className={iconColor}>
      <IconComp size={14} aria-hidden />
    </span>
  );
}
