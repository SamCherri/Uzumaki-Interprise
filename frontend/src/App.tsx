import { useEffect, useMemo, useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { BrokerDashboard } from './pages/BrokerDashboard';
import { CompanyRequestPage } from './pages/CompanyRequestPage';
import { CompaniesPage } from './pages/CompaniesPage';

type PublicTab = 'login' | 'register';
type PrivateScreen = 'home' | 'markets' | 'wallet' | 'company-request' | 'admin' | 'broker';

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [publicTab, setPublicTab] = useState<PublicTab>('login');
  const [screen, setScreen] = useState<PrivateScreen>('home');

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      return;
    }
    localStorage.removeItem('token');
  }, [token]);

  const canGoBack = useMemo(() => screen !== 'home', [screen]);

  function handleLogout() {
    setToken(null);
    setScreen('home');
    setPublicTab('login');
  }

  if (!token) {
    return (
      <main className="container auth-shell">
        <section className="card public-entry-card">
          <header className="public-entry-header">
            <h1>Bolsa Virtual RP</h1>
            <p className="subtitle">Simulação econômica fictícia</p>
            <p className="warning">Sem dinheiro real.</p>
          </header>

          <nav className="pill-nav" aria-label="Alternar entre login e cadastro">
            <button className={publicTab === 'login' ? 'pill active' : 'pill'} onClick={() => setPublicTab('login')}>
              Login
            </button>
            <button className={publicTab === 'register' ? 'pill active' : 'pill'} onClick={() => setPublicTab('register')}>
              Cadastro
            </button>
          </nav>

          {publicTab === 'login' ? (
            <LoginPage
              onSuccess={(newToken) => {
                setToken(newToken);
                setScreen('home');
              }}
              onSwitchRegister={() => setPublicTab('register')}
            />
          ) : (
            <RegisterPage onSwitchLogin={() => setPublicTab('login')} />
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="container mobile-app-shell">
      <header className="card app-mobile-topbar">
        <div className="topbar-row">
          {canGoBack ? (
            <button className="back-button" onClick={() => setScreen('home')}>
              ← Voltar
            </button>
          ) : (
            <span className="back-placeholder" />
          )}
          <div>
            <h1>Bolsa Virtual RP</h1>
            <p className="subtitle">Simulação econômica fictícia</p>
          </div>
          <button className="button-danger small-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {screen === 'home' && (
        <section className="card">
          <h2>🏠 Início</h2>
          <p className="info-text">Escolha uma seção para continuar.</p>
          <div className="home-grid">
            <button className="home-tile" onClick={() => setScreen('markets')}>🏢 Mercados</button>
            <button className="home-tile" onClick={() => setScreen('wallet')}>💼 Carteira</button>
            <button className="home-tile" onClick={() => setScreen('company-request')}>🏦 Solicitar Empresa</button>
            <button className="home-tile" onClick={() => setScreen('admin')}>🛠️ Admin</button>
            <button className="home-tile" onClick={() => setScreen('broker')}>🤝 Corretor</button>
          </div>
        </section>
      )}

      {screen === 'markets' && <CompaniesPage />}
      {screen === 'wallet' && <UserDashboard />}
      {screen === 'company-request' && <CompanyRequestPage />}
      {screen === 'admin' && <AdminDashboard />}
      {screen === 'broker' && <BrokerDashboard />}

      <nav className="card mobile-bottom-nav" aria-label="Menu principal">
        <button className={screen === 'markets' ? 'active' : ''} onClick={() => setScreen('markets')}>Mercados</button>
        <button className={screen === 'wallet' ? 'active' : ''} onClick={() => setScreen('wallet')}>Carteira</button>
        <button className={screen === 'company-request' ? 'active' : ''} onClick={() => setScreen('company-request')}>Empresa</button>
        <button className={screen === 'admin' ? 'active' : ''} onClick={() => setScreen('admin')}>Admin</button>
        <button className={screen === 'broker' ? 'active' : ''} onClick={() => setScreen('broker')}>Corretor</button>
      </nav>
    </main>
  );
}
