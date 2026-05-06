import { ActionButton } from './ActionButton';

type ConfirmEconomicActionProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
};

export function ConfirmEconomicAction({ open, title, description, confirmText = 'Confirmar', loading = false, onConfirm, onCancel, children }: ConfirmEconomicActionProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-content">
        <h3>{title}</h3>
        <p>{description}</p>
        {children}
        <p className="warning">Ação sensível. Revise os dados antes de confirmar.</p>
        <div className="quick-actions">
          <ActionButton variant="secondary" onClick={onCancel} disabled={loading}>Cancelar</ActionButton>
          <ActionButton variant="danger" onClick={onConfirm} loading={loading} loadingText="Confirmando...">{confirmText}</ActionButton>
        </div>
      </div>
    </div>
  );
}
