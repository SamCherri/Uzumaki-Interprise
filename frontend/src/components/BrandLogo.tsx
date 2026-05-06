type BrandLogoProps = {
  size?: 'sm' | 'md' | 'hero';
  subtitle?: boolean;
  className?: string;
};

export function BrandLogo({ size = 'md', subtitle = true, className = '' }: BrandLogoProps) {
  return (
    <div className={`brand-logo brand-logo-${size} ${className}`.trim()}>
      <img src="/assets/rpc_exchange_icon.png" alt="RPC Exchange" className="brand-logo-icon" />
      <div className="brand-logo-text">
        <strong>RPC Exchange</strong>
        {subtitle ? <small>Simulação econômica RP</small> : null}
      </div>
    </div>
  );
}
