type StatusMessageProps = {
  type: 'success' | 'error' | 'warning';
  message: string;
};

export function StatusMessage({ type, message }: StatusMessageProps) {
  return <p className={`status-message ${type}`}>{message}</p>;
}
