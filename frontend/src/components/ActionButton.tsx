import { ButtonHTMLAttributes } from 'react';

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
};

export function ActionButton({ loading = false, loadingText = 'Processando...', disabled, children, className, variant = 'primary', ...rest }: ActionButtonProps) {
  const variantClass =
    variant === 'primary' ? 'button-primary' :
    variant === 'secondary' ? 'button-secondary' :
    variant === 'success' ? 'button-success' : 'button-danger';

  return (
    <button
      {...rest}
      className={`${variantClass}${className ? ` ${className}` : ''}`}
      disabled={loading || disabled}
      aria-busy={loading}
    >
      {loading ? loadingText : children}
    </button>
  );
}
