type ImpactPreviewCardProps = {
  title?: string;
  items: Array<{ label: string; value: string }>;
  warnings?: string[];
};

export function ImpactPreviewCard({ title = 'Preview de impacto', items, warnings = [] }: ImpactPreviewCardProps) {
  return (
    <article className="summary-item compact-card">
      <strong>{title}</strong>
      <div className="stack-sm" style={{ marginTop: 8 }}>
        {items.map((item) => <p key={item.label}><strong>{item.label}:</strong> {item.value}</p>)}
      </div>
      {warnings.length > 0 && (
        <div className="stack-sm" style={{ marginTop: 8 }}>
          {warnings.map((warning) => <p key={warning} className="warning">⚠️ {warning}</p>)}
        </div>
      )}
    </article>
  );
}
