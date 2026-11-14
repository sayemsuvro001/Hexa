import React from 'react';

interface NeonProgressBarProps {
  percent: number;
  accent?: 'cyan' | 'blue' | 'purple' | 'magenta';
  height?: number;
}

export const NeonProgressBar: React.FC<NeonProgressBarProps> = ({
  percent,
  accent = 'cyan',
  height = 8,
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const gradient =
    accent === 'purple'
      ? 'linear-gradient(90deg, #8B4DCE 0%, #B93DBD 100%)'
      : accent === 'blue'
      ? 'linear-gradient(90deg, #1677E8 0%, #00DFFF 100%)'
      : accent === 'magenta'
      ? 'linear-gradient(90deg, #B93DBD 0%, #00DFFF 100%)'
      : 'linear-gradient(90deg, #00DFFF 0%, #1677E8 60%, #8B4DCE 100%)';

  return (
    <div
      className="w-full rounded-sm bg-[#050A17] border border-[#1677E8]/25 overflow-hidden"
      style={{ height }}
    >
      <div
        className="h-full transition-all duration-300"
        style={{
          width: `${clamped}%`,
          background: gradient,
          boxShadow: '0 0 10px rgba(0, 223, 255, 0.4)',
        }}
      />
    </div>
  );
};

interface SparklineGraphProps {
  values: number[];
  maxVal?: number;
  height?: number;
  strokeColor?: string;
  fillId?: string;
}

export const SparklineGraph: React.FC<SparklineGraphProps> = ({
  values,
  maxVal = 100,
  height = 64,
  strokeColor = '#00DFFF',
  fillId = 'sparkGrad',
}) => {
  const width = 320;
  const safeVals = values.length >= 2 ? values : [0, ...(values.length ? values : [0])];
  const max = Math.max(maxVal, ...safeVals, 1);

  const points = safeVals.map((v, i) => {
    const x = (i / (safeVals.length - 1)) * width;
    const y = height - 6 - (Math.max(0, v) / max) * (height - 12);
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full overflow-visible"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8B4DCE" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {/* Subtle horizontal guide lines */}
      <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#1677E8" strokeOpacity="0.14" strokeDasharray="3 3" />
      <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#1677E8" strokeOpacity="0.14" strokeDasharray="3 3" />
      <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#1677E8" strokeOpacity="0.14" strokeDasharray="3 3" />

      <path d={areaPath} fill={`url(#${fillId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3"
          fill="#EAF4FF"
          stroke={strokeColor}
          strokeWidth="2"
        />
      )}
    </svg>
  );
};

interface BarChartSvgProps {
  items: Array<{ label: string; value: number }>;
  height?: number;
  unitFormatter?: (val: number) => string;
}

export const BarChartSvg: React.FC<BarChartSvgProps> = ({
  items,
  height = 120,
}) => {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="w-full flex items-end justify-between gap-1.5" style={{ height }}>
      {items.map((item, idx) => {
        const pct = Math.max(4, Math.round((item.value / max) * 100));
        return (
          <div key={`${item.label}-${idx}`} className="flex-1 flex flex-col items-center h-full justify-end min-w-0">
            <div className="w-full flex-1 flex items-end justify-center px-0.5">
              <div
                className="w-full max-w-[22px] rounded-t-sm transition-all duration-300"
                style={{
                  height: `${item.value === 0 ? 4 : pct}%`,
                  background:
                    item.value === 0
                      ? 'rgba(132, 150, 181, 0.16)'
                      : 'linear-gradient(180deg, #00DFFF 0%, #1677E8 55%, #8B4DCE 100%)',
                  boxShadow:
                    item.value > 0 ? '0 0 8px rgba(0, 223, 255, 0.3)' : undefined,
                }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
            <span className="font-mono-tech text-[10px] text-[#8496B5] mt-1.5 truncate max-w-full">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
