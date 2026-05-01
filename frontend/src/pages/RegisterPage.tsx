import { FormEvent, useState } from 'react';
import { api } from '../services/api';

type RegisterPageProps = {
  onSwitchLogin?: () => void;
};

export function RegisterPage({ onSwitchLogin }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, characterName, bankAccountNumber, email, password }),
      });
      setMessage('Conta criada com sucesso. Entre com o e-mail cadastrado.');
      setName('');
      setCharacterName('');
      setBankAccountNumber('');
      setEmail('');
      setPassword('');
      if (onSwitchLogin) onSwitchLogin();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  return (
    <section className="auth-panel nested-card">
      <h2>Criar conta</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Nome
          <input placeholder="Seu nome" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Nome do personagem
          <input placeholder="Nome do personagem" value={characterName} onChange={(event) => setCharacterName(event.target.value)} required minLength={3} />
        </label>
        <label>
          Número da conta bancária fictícia do RP
          <input placeholder="Ex.: RP-12345" value={bankAccountNumber} onChange={(event) => setBankAccountNumber(event.target.value)} required minLength={3} />
        </label>
        <p className="info-text">A conta bancária é fictícia e usada apenas dentro do RP.</p>
        <label>
          E-mail
          <input placeholder="seuemail@exemplo.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Senha
          <input placeholder="Mínimo 8 caracteres" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        </label>
        <button className="button-primary" type="submit">Cadastrar</button>
      </form>
      {message && <p className="info-text">{message}</p>}
      {onSwitchLogin && (
        <p className="auth-switch-row">
          Já tem conta?{' '}
          <button className="link-button" type="button" onClick={onSwitchLogin}>
            Ir para login
          </button>
        </p>
      )}
    </section>
  );
}
