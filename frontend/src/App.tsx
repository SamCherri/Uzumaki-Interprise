import { useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

type Screen = 'login' | 'register' | 'user' | 'admin';

export function App() {
  const [screen, setScreen] = useState<Screen>('login');

  return (
    <main className="container">
      <header>
        <h1>Bolsa Virtual RP</h1>
        <p className="warning">Ambiente fictício de simulação econômica. Nenhum valor possui conversão para dinheiro real.</p>
      </header>

      <nav className="menu">
        <button onClick={() => setScreen('login')}>Login</button>
        <button onClick={() => setScreen('register')}>Cadastro</button>
        <button onClick={() => setScreen('user')}>Painel Usuário</button>
        <button onClick={() => setScreen('admin')}>Painel Admin</button>
      </nav>

      {screen === 'login' && <LoginPage />}
      {screen === 'register' && <RegisterPage />}
      {screen === 'user' && <UserDashboard />}
      {screen === 'admin' && <AdminDashboard />}
    </main>
  );
}
