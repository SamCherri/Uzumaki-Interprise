import { ReactNode, useEffect } from 'react';

export function BottomSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="bottom-sheet-backdrop" onClick={onClose} role="presentation">
      <section className="bottom-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="bottom-sheet-header">
          <strong>{title}</strong>
          <button type="button" className="side-drawer-close" onClick={onClose} aria-label="Fechar painel">Fechar</button>
        </header>
        <div className="bottom-sheet-content">{children}</div>
      </section>
    </div>
  );
}
