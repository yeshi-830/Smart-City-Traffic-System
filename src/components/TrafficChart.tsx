interface TrafficChartProps {
  data: { time: string; volume: number }[];
}

export default function TrafficChart({ data }: TrafficChartProps) {
  if (data.length === 0) return <div className="chart-empty">Traffic history is not available yet.</div>;

  const width = 600;
  const height = 156;
  const left = 28;
  const right = 18;
  const top = 12;
  const bottom = 25;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = data.map((item) => item.volume);
  const min = Math.min(...values) - 8;
  const max = Math.max(...values) + 8;
  const points = data.map((item, index) => ({
    ...item,
    x: left + (index / Math.max(data.length - 1, 1)) * plotWidth,
    y: top + ((max - item.volume) / Math.max(max - min, 1)) * plotHeight,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${left},${top + plotHeight} ${line} ${left + plotWidth},${top + plotHeight}`;

  return (
    <div className="traffic-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Simulated vehicle volume over the past 12 hours">
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#309978" stopOpacity=".18" />
            <stop offset="100%" stopColor="#309978" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((fraction) => (
          <line key={fraction} x1={left} x2={width - right} y1={top + plotHeight * fraction} y2={top + plotHeight * fraction} className="chart-grid-line" />
        ))}
        <polygon points={area} fill="url(#chart-fill)" />
        <polyline points={line} className="chart-line" />
        {points.map((point) => (
          <g key={point.time}>
            <circle cx={point.x} cy={point.y} r="4.5" className="chart-point" />
            <text x={point.x} y={height - 5} textAnchor="middle" className="chart-time">{point.time}</text>
            <title>{point.time}: {point.volume}% capacity</title>
          </g>
        ))}
      </svg>
    </div>
  );
}
