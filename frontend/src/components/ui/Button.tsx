import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  children,
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  const finalDisabled = disabled || isLoading;
  return (
    <button
      {...props}
      type={type}
      disabled={finalDisabled}
      className={`ui-button ui-button-${variant} ui-button-${size}${isLoading ? ' ui-button-loading' : ''} ${className}`.trim()}
    >
      {!isLoading && leftIcon}
      <span>{isLoading ? 'Processando...' : children}</span>
      {!isLoading && rightIcon}
    </button>
  );
}
