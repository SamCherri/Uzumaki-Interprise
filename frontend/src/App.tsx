import { useEffect, useMemo, useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { BrokerDashboard } from './pages/BrokerDashboard';
import { CompanyRequestPage } from './pages/CompanyRequestPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { WithdrawalsPage } from './pages/WithdrawalsPage';

type PublicTab = 'login' | 'register';
type PrivateScreen = 'home' | 'markets' | 'wallet' | 'withdrawals' | 'company-request' | 'admin' | 'broker';

type ViewerRoles = {
  canSeeAdmin: boolean;
  canSeeBroker: boolean;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN']);
const BROKER_ROLES = new Set(['VIRTUAL_BROKER']);

function decodeRolesFromToken(token: string | null): ViewerRoles {
  if (!token) return { canSeeAdmin: false, canSeeBroker: false };

  try {
    const [, payload] = token.split('.');
    if (!payload) return { canSeeAdmin: false, canSeeBroker: false };

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded)) as { role?: unknown; roles?: unknown };

    const extractedRoles = [
      ...(Array.isArray(parsed.roles) ? parsed.roles : []),
      ...(typeof parsed.role === 'string' ? [parsed.role] : []),
    ]
      .filter((role): role is string => typeof role === 'string')
      .map((role) => role.trim().toUpperCase());

    return {
      canSeeAdmin: extractedRoles.some((role) => ADMIN_ROLES.has(role)),
      canSeeBroker: extractedRoles.some((role) => BROKER_ROLES.has(role)),
    };
  } catch {
    return { canSeeAdmin: false, canSeeBroker: false };
  }
}

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [publicTab, setPublicTab] = useState<PublicTab>('login');
  const [screen, setScreen] = useState<PrivateScreen>('home');
  const [installPromptEvent, setInstallPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
  );
  const [installHint, setInstallHint] = useState('');

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

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as InstallPromptEvent);
      setInstallHint('');
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPromptEvent(null);
      setInstallHint('App instalado com sucesso no seu dispositivo.');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const canGoBack = useMemo(() => screen !== 'home', [screen]);

  async function handleInstallClick() {
    if (isInstalled) {
      setInstallHint('App instalado. Abra pela sua tela inicial.');
      return;
    }

    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallHint('Instalação iniciada.');
      } else {
        setInstallHint('Instalação cancelada. Você pode tentar novamente depois.');
      }
      setInstallPromptEvent(null);
      return;
    }

    setInstallHint('No navegador, toque nos três pontos e escolha Adicionar à tela inicial.');
  }

  function handleLogout() {
    setToken(null);
    setScreen('home');
    setPublicTab('login');
  }

  const showInstallCard = !isInstalled;

  if (!token) {
    return (
      <main className="container auth-shell">
        <section className="card public-entry-card">
          <header className="public-entry-header">
            <h1>RPC Exchange</h1>
            <p className="subtitle">Ferramenta de interpretação de exchange para RP.</p>
            <p className="warning">Esta é uma ferramenta de simulação/interpretação de uma exchange. Nenhum valor possui conversão para dinheiro real.</p>
            <p className="info-text">Sem cripto real, sem blockchain, sem Pix, sem cartão e sem gateway de pagamento.</p>
          </header>

          <article className="card install-card nested-card">
            <h3>📲 Instalar aplicativo</h3>
            <p className="info-text">Use a RPC Exchange como app no celular.</p>
            <button className="button-primary" onClick={handleInstallClick} type="button">
              Instalar aplicativo
            </button>
            {installHint && <p className="info-text">{installHint}</p>}
          </article>

          <div className="benefits-grid nested-card">
            <span>🪙 Crie e negocie tokens</span>
            <span>📈 Gráficos e ordens</span>
            <span>💼 Carteira digital</span>
            <span>📲 Instale como app</span>
          </div>

          <nav className="pill-nav nested-card" aria-label="Alternar entre login e cadastro">
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
            <h1>RPC Exchange</h1>
            <p className="subtitle">Ambiente de simulação econômica</p>
          </div>
          <button className="button-danger small-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {screen === 'home' && (
        <section className="card">
          <h2>Bem-vindo à RPC Exchange</h2>
          <p className="info-text">Negocie tokens criados por usuários com RPC.</p>

          {showInstallCard && (
            <article className="summary-item install-card nested-card">
              <h3>📲 Instalar aplicativo</h3>
              <p className="info-text">Use a RPC Exchange como app no celular.</p>
              <button className="button-primary" onClick={handleInstallClick} type="button">
                Instalar aplicativo
              </button>
              {installHint && <p className="info-text">{installHint}</p>}
            </article>
          )}

          <div className="home-grid home-grid-actions nested-card">
            <button className="home-tile" onClick={() => setScreen('markets')}><span>🪙</span><strong>Mercados</strong><small>Veja ativos disponíveis para negociar.</small></button>
            <button className="home-tile" onClick={() => setScreen('wallet')}><span>💼</span><strong>Carteira</strong><small>Acompanhe seu saldo e seus ativos.</small></button>
            <button className="home-tile" onClick={() => setScreen('withdrawals')}><span>🏧</span><strong>Saque</strong><small>Solicite a retirada de RPC para receber dentro do RP.</small></button>
            <button className="home-tile" onClick={() => setScreen('company-request')}><span>🚀</span><strong>Criar token</strong><small>Crie seu projeto e solicite listagem no mercado.</small></button>
            {roles.canSeeAdmin && <button className="home-tile" onClick={() => setScreen('admin')}><span>🛠️</span><strong>Admin</strong><small>Painel administrativo</small></button>}
            {roles.canSeeBroker && <button className="home-tile" onClick={() => setScreen('broker')}><span>🤝</span><strong>Corretor</strong><small>Painel corretor</small></button>}
            <button className="home-tile home-tile-danger" onClick={handleLogout}><span>🚪</span><strong>Sair</strong><small>Encerrar sessão</small></button>
          </div>
        </section>
      )}

      {screen === 'markets' && <CompaniesPage />}
      {screen === 'wallet' && <UserDashboard />}
      {screen === 'withdrawals' && <WithdrawalsPage />}
      {screen === 'company-request' && <CompanyRequestPage />}
      {screen === 'admin' && roles.canSeeAdmin && <AdminDashboard />}
      {screen === 'broker' && roles.canSeeBroker && <BrokerDashboard />}
    </main>
  );
}
