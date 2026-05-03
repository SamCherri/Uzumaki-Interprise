type ToastProps = {
  message: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
};

export function Toast({ message, variant = 'info' }: ToastProps) {
  if (!message) return null;
  return <p className={`ui-toast ui-toast-${variant}`}>{message}</p>;
}
