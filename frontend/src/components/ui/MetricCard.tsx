type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  trend?: string;
  variant?: 'default' | 'premium' | 'warning';
};

export function MetricCard({ title, value, subtitle, trend, variant = 'default' }: MetricCardProps) {
  return (
    <article className={`ui-metric-card ui-metric-card-${variant}`}>
      <span className="summary-label">{title}</span>
      <strong className="summary-value">{value}</strong>
      {subtitle && <p className="info-text">{subtitle}</p>}
      {trend && <p className="info-text">{trend}</p>}
    </article>
  );
}
