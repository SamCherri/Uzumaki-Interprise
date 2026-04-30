import { useEffect, useMemo, useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { BrokerDashboard } from './pages/BrokerDashboard';
import { CompanyRequestPage } from './pages/CompanyRequestPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { WithdrawalsPage } from './pages/WithdrawalsPage';
import { ProjectOwnerPanel } from './pages/ProjectOwnerPanel';
import { api, getCurrentUser, CurrentUserResponse } from './services/api';
import { SideDrawer, SideDrawerItem } from './components/SideDrawer';

type PublicTab = 'login' | 'register';
type PrivateScreen = 'home' | 'markets' | 'wallet' | 'withdrawals' | 'company-request' | 'admin' | 'broker' | 'my-projects';

type ViewerRoles = {
  canSeeAdmin: boolean;
  canSeeBroker: boolean;
  canSeeProjectOwner: boolean;
};

type CurrentUser = CurrentUserResponse['user'];

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'COIN_CHIEF_ADMIN']);
const BROKER_ROLES = new Set(['VIRTUAL_BROKER']);
const PROJECT_OWNER_ROLES = new Set(['BUSINESS_OWNER']);

function decodeRolesFromToken(token: string | null): ViewerRoles {
  if (!token) return { canSeeAdmin: false, canSeeBroker: false, canSeeProjectOwner: false };

  try {
    const [, payload] = token.split('.');
    if (!payload) return { canSeeAdmin: false, canSeeBroker: false, canSeeProjectOwner: false };

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
      canSeeProjectOwner: extractedRoles.some((role) => PROJECT_OWNER_ROLES.has(role)),
    };
  } catch {
    return { canSeeAdmin: false, canSeeBroker: false, canSeeProjectOwner: false };
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
  const [hasOwnedProjects, setHasOwnedProjects] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isGlobalDrawerOpen, setIsGlobalDrawerOpen] = useState(false);

  const tokenRoles = useMemo(() => decodeRolesFromToken(token), [token]);
  const roles = useMemo(() => {
    if (currentUser) {
      const normalized = currentUser.roles.map((role) => role.trim().toUpperCase());
      return {
        canSeeAdmin: normalized.some((role) => ADMIN_ROLES.has(role)),
        canSeeBroker: normalized.some((role) => BROKER_ROLES.has(role)),
        canSeeProjectOwner: normalized.some((role) => PROJECT_OWNER_ROLES.has(role)),
      };
    }

    return tokenRoles;
  }, [currentUser, tokenRoles]);
  const canSeeMyProjects = roles.canSeeProjectOwner || hasOwnedProjects;

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
    if (screen === 'my-projects' && !canSeeMyProjects) {
      setScreen('home');
    }
  }, [roles.canSeeAdmin, roles.canSeeBroker, canSeeMyProjects, screen]);


  useEffect(() => {
    if (!token) {
      setHasOwnedProjects(false);
      setCurrentUser(null);
      return;
    }

    getCurrentUser()
      .then((response) => {
        setCurrentUser(response.user);
      })
      .catch((error: Error) => {
        if (error.message.toLowerCase().includes('não autenticado')) {
          setToken(null);
          setScreen('home');
          setPublicTab('login');
          return;
        }
        setCurrentUser(null);
      });

    api<{ companies: Array<{ id: string }> }>('/project-boosts/my-projects')
      .then((response) => setHasOwnedProjects(response.companies.length > 0))
      .catch(() => setHasOwnedProjects(false));
  }, [token]);
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

  const globalDrawerItems = useMemo<SideDrawerItem[]>(() => {
    const items: SideDrawerItem[] = [
      { key: 'home', label: 'Início', icon: '🏠', active: screen === 'home', onClick: () => setScreen('home') },
      { key: 'markets', label: 'Mercados', icon: '🪙', active: screen === 'markets', onClick: () => setScreen('markets') },
      { key: 'wallet', label: 'Carteira', icon: '💼', active: screen === 'wallet', onClick: () => setScreen('wallet') },
      { key: 'withdrawals', label: 'Saque', icon: '🏧', active: screen === 'withdrawals', onClick: () => setScreen('withdrawals') },
      { key: 'company-request', label: 'Criar token', icon: '🚀', active: screen === 'company-request', onClick: () => setScreen('company-request') },
    ];

    if (canSeeMyProjects) items.push({ key: 'my-projects', label: 'Meus Projetos', icon: '📊', active: screen === 'my-projects', onClick: () => setScreen('my-projects') });
    if (roles.canSeeAdmin) items.push({ key: 'admin', label: 'Admin', icon: '🛠️', active: screen === 'admin', onClick: () => setScreen('admin') });
    if (roles.canSeeBroker) items.push({ key: 'broker', label: 'Corretor', icon: '🤝', active: screen === 'broker', onClick: () => setScreen('broker') });

    items.push({ key: 'logout', label: 'Sair', icon: '🚪', danger: true, onClick: handleLogout });
    return items;
  }, [canSeeMyProjects, roles.canSeeAdmin, roles.canSeeBroker, screen]);

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
        <div className="topbar-row mobile-topbar-layout">
          {canGoBack ? (
            <button className="back-button desktop-only" onClick={() => setScreen('home')}>
              ← Voltar
            </button>
          ) : (
            <span className="back-placeholder desktop-only" />
          )}
          <button className="hamburger-button mobile-only" type="button" aria-label="Abrir menu" onClick={() => setIsGlobalDrawerOpen(true)}>☰</button>
          <div className="mobile-topbar-title">
            <h1>RPC Exchange</h1>
            <p className="subtitle">Simulação econômica RP</p>
          </div>
          <button className="button-danger small-button desktop-only" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <SideDrawer
        title="Menu principal"
        subtitle="Navegação rápida da RPC Exchange"
        open={isGlobalDrawerOpen}
        onClose={() => setIsGlobalDrawerOpen(false)}
        items={globalDrawerItems}
      />

      {screen === 'home' && (
        <section className="card">
          {showInstallCard && (
            <article className="summary-item install-card">
              <h3>📲 Instalar aplicativo</h3>
              <p className="info-text">Use a RPC Exchange como app no celular.</p>
              <button className="button-primary" onClick={handleInstallClick} type="button">
                Instalar aplicativo
              </button>
              {installHint && <p className="info-text">{installHint}</p>}
            </article>
          )}

          <section className="mobile-home-summary mobile-only">
            <div className="mobile-hero-card">
              <span className="mobile-hero-kicker">Painel principal</span>
              <h2>Bem-vindo à RPC Exchange</h2>
              <p>Negocie tokens, acompanhe sua carteira e acesse seus painéis pelo menu.</p>
            </div>

            <div className="mobile-primary-actions">
              <button className="mobile-action-card" onClick={() => setScreen('markets')}>
                <span>🪙</span>
                <strong>Mercados</strong>
                <small>Comprar e vender tokens</small>
              </button>
              <button className="mobile-action-card" onClick={() => setScreen('wallet')}>
                <span>💼</span>
                <strong>Carteira</strong>
                <small>Saldo e ativos</small>
              </button>
              {roles.canSeeAdmin && (
                <button className="mobile-action-card mobile-action-wide" onClick={() => setScreen('admin')}>
                  <span>🛠️</span>
                  <strong>Admin</strong>
                  <small>Tesouraria, usuários e auditoria</small>
                </button>
              )}
            </div>

            <div className="mobile-menu-hint">
              <span>☰</span>
              <p>Use o menu lateral para acessar Saque, Criar token, Projetos, Corretor e Sair.</p>
            </div>
          </section>

          <h2 className="desktop-only">Bem-vindo à RPC Exchange</h2>
          <p className="info-text desktop-only">Negocie tokens criados por usuários com RPC.</p>

          <div className="home-grid home-grid-actions nested-card desktop-home-actions desktop-only">
            <button className="home-tile" onClick={() => setScreen('markets')}><span>🪙</span><strong>Mercados</strong><small>Veja ativos disponíveis para negociar.</small></button>
            <button className="home-tile" onClick={() => setScreen('wallet')}><span>💼</span><strong>Carteira</strong><small>Acompanhe seu saldo e seus ativos.</small></button>
            <button className="home-tile" onClick={() => setScreen('withdrawals')}><span>🏧</span><strong>Saque</strong><small>Solicite a retirada de RPC para receber dentro do RP.</small></button>
            <button className="home-tile" onClick={() => setScreen('company-request')}><span>🚀</span><strong>Criar token</strong><small>Crie seu projeto e solicite listagem no mercado.</small></button>
            {canSeeMyProjects && <button className="home-tile" onClick={() => setScreen('my-projects')}><span>📊</span><strong>Meus Projetos</strong><small>Gerencie impulsões da sua moeda.</small></button>}
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
      {screen === 'my-projects' && canSeeMyProjects && <ProjectOwnerPanel />}
      {screen === 'admin' && roles.canSeeAdmin && <AdminDashboard currentUserRoles={currentUser?.roles ?? []} onPermissionsUpdated={async () => { const response = await getCurrentUser(); setCurrentUser(response.user); }} />}
      {screen === 'broker' && roles.canSeeBroker && <BrokerDashboard />}
    </main>
  );
}
