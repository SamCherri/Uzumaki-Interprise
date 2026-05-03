import { useId, useMemo, useState } from 'react';
import { formatCurrency, formatPrice } from '../utils/formatters';

export type MarketChartPoint = {
  timestamp: string;
  price: number;
  volume?: number;
  tradeCount?: number;
};

type MarketLineChartProps = {
  points: MarketChartPoint[];
  currentPrice?: number;
  timeframe?: string;
  height?: number;
  emptyMessage?: string;
};

type PlotPoint = MarketChartPoint & { x: number; y: number };

export function MarketLineChart({ points, currentPrice = 0, timeframe = '24H', height = 260, emptyMessage = 'Sem dados suficientes para o gráfico.' }: MarketLineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, '');

  const chart = useMemo(() => {
    const sorted = [...points].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).filter((point) => Number.isFinite(point.price) && point.price > 0);
    if (sorted.length === 0) return { data: [] as PlotPoint[], linePoints: '', areaPoints: '', min: 0, max: 0, currentY: 52, minY: 86, maxY: 20, firstX: 6, middleX: 50, lastX: 94, timeStart: '', timeMiddle: '', timeEnd: '', hasVolume: false, maxVolume: 0 };

    const prices = sorted.map((point) => point.price);
    const refPrice = currentPrice > 0 ? currentPrice : prices[prices.length - 1];
    const rawMin = Math.min(...prices, refPrice);
    const rawMax = Math.max(...prices, refPrice);
    const spread = Math.max(rawMax - rawMin, Math.max(rawMin, refPrice) * 0.004, 0.01);
    const minBound = Math.max(0.0001, rawMin - spread * 0.4);
    const maxBound = rawMax + spread * 0.4;
    const firstTimestamp = new Date(sorted[0].timestamp).getTime();
    const lastTimestamp = new Date(sorted[sorted.length - 1].timestamp).getTime();
    const range = Math.max(1, lastTimestamp - firstTimestamp);
    const yFor = (price: number) => 86 - ((price - minBound) / Math.max(maxBound - minBound, 0.0001)) * 66;

    const data = sorted.map((point, index) => {
      const at = new Date(point.timestamp).getTime();
      const x = Number.isFinite(at) ? 6 + ((at - firstTimestamp) / range) * 88 : 6 + (index / Math.max(1, sorted.length - 1)) * 88;
      return { ...point, x, y: yFor(point.price) };
    });

    const linePoints = data.map((point) => `${point.x},${point.y}`).join(' ');
    const areaPoints = `6,86 ${linePoints} 94,86`;
    const volumes = data.map((item) => item.volume ?? item.tradeCount ?? 0).filter((item) => item > 0);

    const firstPoint = data[0];
    const middlePoint = data[Math.floor((data.length - 1) / 2)];
    const lastPoint = data[data.length - 1];

    const formatTime = (timestamp: string) => {
      const at = new Date(timestamp);
      if (timeframe === '24H') return at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (timeframe === '7D' || timeframe === '30D') return at.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      return at.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return {
      data,
      linePoints,
      areaPoints,
      min: rawMin,
      max: rawMax,
      currentY: yFor(refPrice),
      minY: yFor(rawMin),
      maxY: yFor(rawMax),
      firstX: firstPoint.x,
      middleX: middlePoint.x,
      lastX: lastPoint.x,
      timeStart: formatTime(firstPoint.timestamp),
      timeMiddle: formatTime(middlePoint.timestamp),
      timeEnd: formatTime(lastPoint.timestamp),
      hasVolume: volumes.length > 0,
      maxVolume: Math.max(...volumes, 1),
    };
  }, [currentPrice, points, timeframe]);

  const activeIndex = hoveredIndex ?? (chart.data.length ? chart.data.length - 1 : null);
  const activePoint = activeIndex !== null ? chart.data[activeIndex] : null;

  const currentValue = (currentPrice > 0 ? currentPrice : activePoint?.price) ?? 0;
  const currentY = Math.max(8, Math.min(86, chart.currentY));
  const maxY = Math.max(8, Math.min(86, chart.maxY));
  const minY = Math.max(8, Math.min(86, chart.minY));
  const showMax = Math.abs(maxY - currentY) > 5;
  const showMin = Math.abs(minY - currentY) > 5;

  const setIndexFromPointer = (clientX: number, rect: DOMRect) => {
    if (chart.data.length === 0) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    chart.data.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    setHoveredIndex(closestIndex);
  };

  if (chart.data.length === 0) return <p className="market-line-chart-empty">{emptyMessage}</p>;

  return (
    <div className="market-line-chart" style={{ minHeight: `${height}px` }} key={timeframe}>
      <div
        className="market-line-chart-stage"
        onMouseLeave={() => setHoveredIndex(null)}
        onMouseMove={(event) => setIndexFromPointer(event.clientX, event.currentTarget.getBoundingClientRect())}
        onTouchMove={(event) => setIndexFromPointer(event.touches[0].clientX, event.currentTarget.getBoundingClientRect())}
        onTouchStart={(event) => setIndexFromPointer(event.touches[0].clientX, event.currentTarget.getBoundingClientRect())}
        onTouchCancel={() => setHoveredIndex(null)}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="market-line-chart-svg">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(56,189,248,0.2)" />
              <stop offset="100%" stopColor="rgba(56,189,248,0.02)" />
            </linearGradient>
          </defs>

          {[18, 32, 46, 60, 74, 86].map((lineY) => <line key={`h-${lineY}`} className="market-line-chart-grid" x1="6" x2="94" y1={lineY} y2={lineY} />)}
          {[chart.firstX, chart.middleX, chart.lastX].map((lineX, index) => <line key={`v-${index}`} className="market-line-chart-grid market-line-chart-grid-vertical" x1={lineX} x2={lineX} y1="14" y2="86" />)}

          <line className="current-price-line" x1="6" x2="94" y1={chart.currentY} y2={chart.currentY} />
          <polygon points={chart.areaPoints} className="market-line-chart-area" style={{ fill: `url(#${gradientId})` }} />
          <polyline points={chart.linePoints} className="market-line-chart-line" vectorEffect="non-scaling-stroke" />

          {activePoint && <>
            <line className="market-line-chart-cursor" x1={activePoint.x} x2={activePoint.x} y1="14" y2="86" />
            <line className="market-line-chart-cursor market-line-chart-cursor-horizontal" x1="6" x2="94" y1={activePoint.y} y2={activePoint.y} />
            <circle className="market-line-chart-dot" cx={activePoint.x} cy={activePoint.y} r="1.1" />
          </>}
        </svg>

        {activePoint && (
          <div className="market-line-chart-tooltip" style={{ left: `${Math.min(68, Math.max(2, activePoint.x - 13))}%` }}>
            <span><strong>Preço:</strong> R$ {formatPrice(activePoint.price)}</span>
            <span><strong>Data:</strong> {new Date(activePoint.timestamp).toLocaleString('pt-BR')}</span>
            {typeof activePoint.volume === 'number' && <span><strong>Volume:</strong> {formatCurrency(activePoint.volume)}</span>}
            {typeof activePoint.tradeCount === 'number' && <span><strong>Trades:</strong> {activePoint.tradeCount}</span>}
          </div>
        )}

        <div className="market-line-chart-scale">
          {showMax && <span style={{ top: `${maxY}%` }}>R$ {formatPrice(chart.max)}</span>}
          {showMin && <span style={{ top: `${minY}%` }}>R$ {formatPrice(chart.min)}</span>}
        </div>

        <div className="market-line-chart-price-label" style={{ top: `${currentY}%` }}>R$ {formatPrice(currentValue)}</div>
      </div>

      <div className="market-line-chart-time-axis">
        <span>{chart.timeStart}</span>
        <span>{chart.timeMiddle}</span>
        <span>{chart.timeEnd}</span>
      </div>

      {chart.hasVolume && (
        <div className="market-line-chart-volume">
          {chart.data.slice(-40).map((point) => {
            const value = point.volume ?? point.tradeCount ?? 0;
            const size = Math.max(5, Math.min(65, (value / chart.maxVolume) * 65));
            return <span key={`${point.timestamp}-${point.price}`} style={{ height: `${size}%` }} />;
          })}
        </div>
      )}

      <div className="chart-meta market-price-card"><div><span>Atual</span><strong>R$ {formatPrice(currentPrice)}</strong></div><div><span>Máximo</span><strong>R$ {formatPrice(chart.max)}</strong></div><div><span>Mínimo</span><strong>R$ {formatPrice(chart.min)}</strong></div></div>
    </div>
  );
}
