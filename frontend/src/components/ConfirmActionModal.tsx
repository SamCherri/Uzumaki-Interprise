import { ReactNode } from 'react';

type ConfirmActionModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireConfirmText?: string;
  confirmTextValue?: string;
  extraFields?: ReactNode;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
};

export function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmar ação',
  cancelLabel = 'Cancelar',
  danger = false,
  requireConfirmText,
  confirmTextValue,
  extraFields,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmActionModalProps) {
  if (!open) return null;

  const textMatches = !requireConfirmText || confirmTextValue === requireConfirmText;
  const disableConfirm = isLoading || !textMatches || !open;

  return (
    <div className="confirm-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`confirm-modal ${danger ? 'danger' : ''}`}>
        <h3>{title}</h3>
        <p>{description}</p>
        {danger && <p className="status-message error">Atenção: esta ação é sensível e será auditada.</p>}
        {extraFields}
        {requireConfirmText && <p className="info-text">Digite <strong>{requireConfirmText}</strong> para confirmar.</p>}
        <div className="action-grid">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={isLoading}>{cancelLabel}</button>
          <button type="button" className="button-danger" onClick={() => void onConfirm()} disabled={disableConfirm}>{isLoading ? 'Processando...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
