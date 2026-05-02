import { ReactNode } from 'react';

type ConfirmActionModalProps = {
  open: boolean;
  title: string;
  description: string;
  danger?: boolean;
  requireConfirmText?: string;
  confirmTextValue?: string;
  isLoading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  extraFields?: ReactNode;
};

export function ConfirmActionModal({
  open,
  title,
  description,
  danger = false,
  requireConfirmText,
  confirmTextValue = '',
  isLoading = false,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onCancel,
  onConfirm,
  extraFields,
}: ConfirmActionModalProps) {
  if (!open) return null;

  const needsConfirmText = Boolean(requireConfirmText);
  const hasRequiredConfirmText = !needsConfirmText || confirmTextValue.trim().toUpperCase() === requireConfirmText;
  const isConfirmDisabled = isLoading || !hasRequiredConfirmText;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-action-modal-title">
      <div className="card nested-card" style={{ maxWidth: 560, margin: '5vh auto' }}>
        <h3 id="confirm-action-modal-title">{title}</h3>
        <p className={danger ? 'status-message error' : 'info-text'}>{description}</p>

        {extraFields && <div className="form-grid">{extraFields}</div>}

        {needsConfirmText && !hasRequiredConfirmText && (
          <p className="status-message error">Digite exatamente {requireConfirmText} para confirmar.</p>
        )}

        <div className="form-grid">
          <button className="button-secondary" type="button" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button className={danger ? 'button-danger' : 'button-primary'} type="button" onClick={onConfirm} disabled={isConfirmDisabled}>
            {isLoading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
