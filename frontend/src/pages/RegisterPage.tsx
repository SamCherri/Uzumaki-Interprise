import { FormEvent, useState } from 'react';
import { api } from '../services/api';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      setMessage('Conta criada com sucesso. Faça login para continuar.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <section className="card">
      <h2>Cadastro</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} required />
        <input placeholder="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input placeholder="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        <button type="submit">Criar conta</button>
      </form>
      {message && <p>{message}</p>}
    </section>
  );
}
