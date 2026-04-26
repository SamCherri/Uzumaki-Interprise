import { FormEvent, useState } from 'react';
import { api } from '../services/api';

export function LoginPage() {
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
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input placeholder="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button type="submit">Entrar</button>
      </form>
      {message && <p>{message}</p>}
    </section>
  );
}
