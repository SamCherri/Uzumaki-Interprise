import { FormEvent, useState } from 'react';
import { api } from '../services/api';

type LoginPageProps = {
  onSuccess?: (token: string) => void;
  onSwitchRegister?: () => void;
};

export function LoginPage({ onSuccess, onSwitchRegister }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('token', result.token);
      setMessage('Login realizado com sucesso.');
      onSuccess?.(result.token);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <section className="auth-panel">
      <h2>Entrar</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input placeholder="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button className="button-primary" type="submit">Entrar</button>
      </form>
      {message && <p className="info-text">{message}</p>}
      {onSwitchRegister && (
        <p className="auth-switch-row">
          Novo por aqui?{' '}
          <button className="link-button" type="button" onClick={onSwitchRegister}>
            Criar cadastro
          </button>
        </p>
      )}
    </section>
  );
}
