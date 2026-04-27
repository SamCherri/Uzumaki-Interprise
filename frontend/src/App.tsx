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

type ViewerRoles = {
  canSeeAdmin: boolean;
  canSeeBroker: boolean;
};

function decodeRolesFromToken(token: string | null): ViewerRoles {
  if (!token) return { canSeeAdmin: false, canSeeBroker: false };

  try {
    const [, payload] = token.split('.');
    if (!payload) return { canSeeAdmin: false, canSeeBroker: false };

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded)) as {
      role?: string;
      roles?: string[];
      isAdmin?: boolean;
      isBroker?: boolean;
    };

    const declaredRoles = [
      ...(Array.isArray(parsed.roles) ? parsed.roles : []),
      ...(parsed.role ? [parsed.role] : []),
    ].map((role) => role.toLowerCase());

    const canSeeAdmin = parsed.isAdmin === true || declaredRoles.some((role) => role.includes('admin'));
    const canSeeBroker = parsed.isBroker === true || declaredRoles.some((role) => role.includes('broker') || role.includes('corretor'));

    return { canSeeAdmin, canSeeBroker };
  } catch {
    return { canSeeAdmin: false, canSeeBroker: false };
  }
}

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [publicTab, setPublicTab] = useState<PublicTab>('login');
  const [screen, setScreen] = useState<PrivateScreen>('home');

  const roles = useMemo(() => decodeRolesFromToken(token), [token]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      return;
    }
    localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (screen === 'admin' && !roles.canSeeAdmin) {
      setScreen('home');
    }
    if (screen === 'broker' && !roles.canSeeBroker) {
      setScreen('home');
    }
  }, [roles.canSeeAdmin, roles.canSeeBroker, screen]);

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
          <p className="info-text">Escolha uma seção.</p>
          <div className="home-grid home-grid-actions">
            <button className="home-tile" onClick={() => setScreen('markets')}>🏢 Mercados</button>
            <button className="home-tile" onClick={() => setScreen('wallet')}>💼 Carteira</button>
            {roles.canSeeBroker && <button className="home-tile" onClick={() => setScreen('broker')}>🤝 Painel Corretor</button>}
            {roles.canSeeAdmin && <button className="home-tile" onClick={() => setScreen('admin')}>🛠️ Painel Admin</button>}
            <button className="home-tile" onClick={() => setScreen('company-request')}>🏦 Solicitar Empresa</button>
            <button className="home-tile home-tile-danger" onClick={handleLogout}>🚪 Sair</button>
          </div>
        </section>
      )}

      {screen === 'markets' && <CompaniesPage />}
      {screen === 'wallet' && <UserDashboard />}
      {screen === 'company-request' && <CompanyRequestPage />}
      {screen === 'admin' && roles.canSeeAdmin && <AdminDashboard />}
      {screen === 'broker' && roles.canSeeBroker && <BrokerDashboard />}
    </main>
  );
}
