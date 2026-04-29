import { FormEvent, useEffect, useMemo, useState } from 'react';

type Field = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'textarea';
  required?: boolean;
  placeholder?: string;
};

type Props = {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  fields: Field[];
  initialValues?: Record<string, string>;
  onCancel: () => void;
  onConfirm: (values: Record<string, string>) => Promise<void> | void;
  isSubmitting?: boolean;
};

export function AdminActionModal({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  danger = false,
  fields,
  initialValues,
  onCancel,
  onConfirm,
  isSubmitting = false,
}: Props) {
  const initialState = useMemo(() => {
    const values: Record<string, string> = {};
    for (const field of fields) {
      values[field.name] = initialValues?.[field.name] ?? '';
    }
    return values;
  }, [fields, initialValues]);

  const [values, setValues] = useState<Record<string, string>>(initialState);
  const [error, setError] = useState('');

  useEffect(() => {
    setValues(initialState);
    setError('');
  }, [initialState]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await onConfirm(values);
    } catch (err) {
      setError((err as Error).message || 'Não foi possível concluir a ação.');
    }
  }

  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-action-modal-title">
      <form className="admin-modal" onSubmit={handleSubmit}>
        <header className="admin-modal-header">
          <h4 id="admin-action-modal-title">{title}</h4>
          {description ? <p>{description}</p> : null}
        </header>
        <div className="admin-modal-body">
          {fields.map((field) => {
            const inputType = field.type ?? 'text';
            return (
              <label key={field.name} className="admin-modal-field">
                <span>{field.label}</span>
                {inputType === 'textarea' ? (
                  <textarea
                    value={values[field.name] ?? ''}
                    onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                    placeholder={field.placeholder}
                    required={field.required}
                    disabled={isSubmitting}
                  />
                ) : (
                  <input
                    type={inputType}
                    value={values[field.name] ?? ''}
                    onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                    placeholder={field.placeholder}
                    required={field.required}
                    disabled={isSubmitting}
                  />
                )}
              </label>
            );
          })}
          {error ? <p className="admin-modal-error">{error}</p> : null}
        </div>
        <footer className="admin-modal-footer">
          <button type="button" onClick={onCancel} disabled={isSubmitting}>{cancelLabel}</button>
          <button type="submit" className={danger ? 'button-danger' : 'button-primary'} disabled={isSubmitting}>{isSubmitting ? 'Enviando...' : confirmLabel}</button>
        </footer>
      </form>
    </div>
  );
}
