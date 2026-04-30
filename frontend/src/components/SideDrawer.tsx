import { useEffect } from 'react';

export type SideDrawerItem = {
  key: string;
  label: string;
  icon?: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
};

type SideDrawerProps = {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  items: SideDrawerItem[];
};

export function SideDrawer({ title, subtitle, open, onClose, items }: SideDrawerProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="side-drawer-backdrop" onClick={onClose} aria-label="Fechar menu lateral" role="presentation">
      <aside
        className="side-drawer"
        onClick={(event) => event.stopPropagation()}
        aria-label={title}
        role="dialog"
        aria-modal="true"
      >
        <header className="side-drawer-header">
          <div className="side-drawer-title">
            <strong>{title}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
          <button type="button" className="side-drawer-close" onClick={onClose} aria-label="Fechar menu">
            ✕
          </button>
        </header>

        <nav className="side-drawer-list" aria-label={`Navegação de ${title}`}>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`side-drawer-item${item.active ? ' active' : ''}${item.danger ? ' danger' : ''}`}
              onClick={() => {
                item.onClick();
                onClose();
              }}
            >
              {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}
