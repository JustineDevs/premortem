'use client';

type ChartTooltipRow = {
  projectName?: string;
  score?: number;
  risks?: number;
};

type ChartTooltipEntry = {
  name?: string;
  value?: number;
  payload?: ChartTooltipRow;
};

export function OsChartTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;

  return (
    <div
      className="rounded-md border border-[#1E2522] bg-[#1E2522] px-3 py-2 shadow-lg"
      role="tooltip"
    >
      <p className="text-[11px] font-semibold text-[#FAF8F5]">{label}</p>
      {row?.projectName ? (
        <p className="mt-0.5 text-[10px] text-emerald-200">{row.projectName}</p>
      ) : null}
      <div className="mt-1.5 space-y-0.5 font-mono text-[10px]">
        {payload.map((entry) => (
          <p key={entry.name} className="text-[#FAF8F5]">
            <span className="text-emerald-300">{entry.name}: </span>
            <span className="font-bold text-white">{entry.value}</span>
          </p>
        ))}
        {typeof row?.risks === 'number' ? (
          <p className="text-rose-200">
            Open risks: <span className="font-bold text-white">{row.risks}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
