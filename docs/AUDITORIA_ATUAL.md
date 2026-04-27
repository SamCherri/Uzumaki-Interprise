# AUDITORIA_ATUAL

Auditoria consolidada do estado atual da **Bolsa Virtual RP**, mantendo o projeto existente (sem recriação do zero).

## 1) O que já está implementado

- ✅ autenticação
- ✅ usuários
- ✅ roles
- ✅ carteira
- ✅ tesouraria
- ✅ corretor
- ✅ empresas
- ✅ cotas
- ✅ oferta inicial
- ✅ ordens
- ✅ livro de ofertas
- ✅ matching engine
- ✅ trades
- ✅ histórico
- ✅ painel admin
- ✅ painel corretor
- ✅ frontend mobile
- ✅ fluxo de login/cadastro separado
- ✅ controle visual de Admin/Corretor por perfil

## 2) O que está parcial

- ⚠️ gráficos simples
- ⚠️ UX mobile
- ⚠️ PWA/app instalável
- ⚠️ ranking
- ⚠️ auditoria avançada
- ⚠️ carteira da empresa
- ⚠️ carteira da plataforma
- ⚠️ distribuição de taxas
- ⚠️ dashboard admin completo

## 3) O que ainda falta

- ❌ PWA completo
- ❌ gráfico por período 1h/24h/7d/30d
- ❌ volume negociado
- ❌ ranking de empresas
- ❌ carteira de receita da empresa
- ❌ carteira da plataforma
- ❌ histórico detalhado de taxas
- ❌ retirada/reinvestimento da receita da empresa
- ❌ painel admin avançado de usuários/ordens/trades/logs
- ❌ testes automatizados mais robustos

## 4) Riscos atuais

- frontend ainda pode parecer protótipo técnico se não melhorar visual;
- gráfico pode ficar pobre sem trades;
- taxas são calculadas, mas ainda precisam ser distribuídas contabilmente;
- usuário comum pode se confundir com termos técnicos se eles reaparecerem;
- PWA ainda não implementado;
- fluxo multiusuário precisa ser testado manualmente.

## 5) Próximas PRs recomendadas (prioridade)

### PR A — Visual/PWA
- modernizar frontend;
- melhorar gráfico;
- adicionar botão Instalar aplicativo;
- manifest;
- service worker;
- PWA.

### PR B — Economia de taxas
- PlatformAccount;
- CompanyRevenueAccount;
- FeeDistribution;
- dividir taxas entre plataforma e empresa.

### PR C — Admin avançado
- ver usuários;
- bloquear/desbloquear;
- ver ordens;
- ver trades;
- ver logs;
- ajustar saldo com justificativa.

### PR D — Gráficos avançados
- períodos 1h/24h/7d/30d;
- volume;
- variação percentual;
- ranking.

