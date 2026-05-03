import { ReactNode } from 'react';
import { Button } from './Button';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  danger?: boolean;
};

export function Modal({ open, title, description, children, footer, onClose, danger = false }: ModalProps) {
  if (!open) return null;
  return (
    <div className="ui-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title">
      <div className="ui-modal">
        <div className="admin-modal-header">
          <h4 id="ui-modal-title">{title}</h4>
          {description && <p className={danger ? 'admin-modal-error' : undefined}>{description}</p>}
        </div>
        {children && <div className="admin-modal-body">{children}</div>}
        <div className="admin-modal-footer">
          {footer ?? <Button variant="secondary" onClick={onClose}>Fechar</Button>}
        </div>
      </div>
    </div>
  );
}
