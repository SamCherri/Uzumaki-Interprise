import { useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { BrokerDashboard } from './pages/BrokerDashboard';
import { CompanyRequestPage } from './pages/CompanyRequestPage';
import { CompaniesPage } from './pages/CompaniesPage';

type Screen = 'login' | 'register' | 'user' | 'admin' | 'broker' | 'company-request' | 'companies';

export function App() {
  const [screen, setScreen] = useState<Screen>('login');

  return (
    <main className="container">
      <header className="app-header card">
        <h1>Bolsa Virtual RP</h1>
        <p className="subtitle">Simulação econômica fictícia</p>
        <p className="warning">Sem dinheiro real.</p>
      </header>

      <nav className="menu app-menu">
        <button onClick={() => setScreen('login')}>🔐 Login</button>
        <button onClick={() => setScreen('register')}>📝 Cadastro</button>
        <button onClick={() => setScreen('user')}>👤 Painel Usuário</button>
        <button onClick={() => setScreen('admin')}>🛡️ Painel Admin</button>
        <button onClick={() => setScreen('broker')}>💼 Painel Corretor</button>
        <button onClick={() => setScreen('company-request')}>🏦 Solicitar Empresa</button>
        <button onClick={() => setScreen('companies')}>🏢 Empresas</button>
      </nav>

      {screen === 'login' && <LoginPage />}
      {screen === 'register' && <RegisterPage />}
      {screen === 'user' && <UserDashboard />}
      {screen === 'admin' && <AdminDashboard />}
      {screen === 'broker' && <BrokerDashboard />}
      {screen === 'company-request' && <CompanyRequestPage />}
      {screen === 'companies' && <CompaniesPage />}
    </main>
  );
}
