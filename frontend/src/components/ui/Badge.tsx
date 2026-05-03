import { ReactNode } from 'react';

type BadgeProps = {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'premium';
  children: ReactNode;
};

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={`ui-badge ui-badge-${variant}`}>{children}</span>;
}
