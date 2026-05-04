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
    <section className="auth-panel nested-card">
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <img src="/assets/logo-full.png" alt="RPC Exchange" style={{ maxWidth: '200px', height: 'auto' }} />
      </div>
      <h2>Entrar</h2>
      <form onSubmit={handleSubmit}>
        <label>
          E-mail
          <input placeholder="seuemail@exemplo.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Senha
          <input placeholder="********" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
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
