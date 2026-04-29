# AUDITORIA_ATUAL

Auditoria consolidada do estado atual da **RPC Exchange**, mantendo o projeto existente (sem recriação do zero).

## 1) Implementado

- ✅ fluxo mobile;
- ✅ PWA (manifest + service worker), quando habilitado no frontend;
- ✅ interface moderna nas telas principais já entregues;
- ✅ controle visual por perfil (Admin/Corretor/Usuário);
- ✅ autenticação, carteira, ordens, livro de ofertas, matching engine e histórico;
- ✅ carteiras de taxa (`PlatformAccount` e `CompanyRevenueAccount`) com distribuição 50/50 registrada em `FeeDistribution`.
- ✅ módulo de saque manual (`WithdrawalRequest`) com saldo pendente em carteira e decisão administrativa (processar/concluir/rejeitar).

## 2) Parcial

- ✅ revisão final de nomenclatura pública para RPC Exchange;
- ⚠️ depósito por solicitação direta de usuário ainda não implementado (entrada segue por Admin/Corretor);
- ⚠️ painel admin avançado;
- ⚠️ gráficos avançados (períodos, volume e leitura mais rica);
- ⚠️ ranking de mercados;
- ⚠️ carteira da plataforma (visão administrativa expandida);
- ⚠️ uso/retirada da receita dos projetos;
- ⚠️ possível renomeação interna futura de Company/Shares para Project/Token.

## 3) Próximos passos recomendados

- ✅ limpeza de termos antigos no frontend;
- revisar tela de criação para usar "Criar token" e "Solicitar listagem";
- revisar mercados para reforçar pares dinâmicos `TICKER/RPC` e evitar pares fixos/oficiais;
- ✅ linguagem admin como moderação de listagens;
- validar que admin não aparece como criador de token/projeto.

## Implementado em 2026-04-28
- Gestão de usuários e roles via admin.
- Gestão de tokens/mercados via admin.
- Criação manual de token/projeto pelo admin.
- Pausa, reativação e encerramento de mercado com auditoria.
- Exclusão definitiva segura somente sem histórico econômico.

## Pendente
- Filtros avançados de logs.
- Relatórios financeiros consolidados.
- Gráficos avançados e ranking.
- Gestão completa de receita de projeto.
- Liquidação/devolução automática avançada para casos complexos.

## Auditoria e Relatórios Administrativos
- Implementado painel de Auditoria avançada (logs, transações, transferências, saques, ordens e trades) somente leitura.
- Implementado painel de Relatórios com visão geral financeira, conta da plataforma e receitas por projeto/token.
- Filtros básicos: busca, status/tipo (quando aplicável), período e paginação (padrão 20, máximo 100).
- Segurança: acesso restrito a ADMIN, SUPER_ADMIN e COIN_CHIEF_ADMIN.

### Implementado
- Auditoria avançada.
- Relatórios administrativos.
- Histórico de transferências.
- Histórico de transações.
- Histórico de saques.
- Histórico de ordens.
- Histórico de trades.

### Pendente
- Exportação CSV/PDF.
- Filtros avançados por intervalo com calendário.
- Gráficos administrativos.
- Relatório por corretor.
- Relatório por usuário.
- Notificações.



## Atualização 2026-04-29 — Impulsão definitiva
Implementado: reserva de boost por projeto, histórico de injeções, fonte por carteira pessoal/receita/ajuste admin e logs de auditoria.
Pendente: fórmula avançada, recompra/queima, automação de retirada de lucro da Exchange.

## Atualização 2026-04-29 — Segurança econômica no matching multi-fill
- **Severidade:** CRÍTICO.
- **Risco identificado:** inconsistência de saldo/bloqueio quando uma ordem executa em múltiplos fills no mesmo loop de matching, por uso de snapshots antigos de wallet/ordem.
- **Correção aplicada:** revisão completa de `runMatching` para recarregar estado atual da ordem taker a cada fill, debitar `availableBalance`/`lockedBalance` com `updateMany` condicionado (`gte`) e `increment/decrement` atômico, validar bloqueios negativos e interromper com erro claro em inconsistência.
- **Proteções garantidas:** sem `availableBalance` negativo, sem `lockedBalance` negativo, sem `lockedCash` negativo, sem `lockedShares` negativo e reembolso consistente da sobra em ordem limite de compra.
- **Regra econômica preservada:** sem alteração na taxa 50/50 e sem alteração da fórmula de preço/matching econômico.

## Fluxos de distribuição de RPC

Fluxo normal:
Tesouraria → Corretor → Jogador

Fluxo administrativo:
Tesouraria → Jogador, com justificativa obrigatória e auditoria

Regras:
- Toda emissão de RPC precisa de motivo.
- Todo envio da tesouraria precisa de motivo.
- Depósito direto ADM → jogador só deve ser usado para evento, correção, premiação ou ajuste administrativo.
- Toda ação deve gerar AdminLog.
- Operações financeiras devem registrar Transaction quando impactarem carteira de usuário.


## Visibilidade pública de projetos desligados

Regras:
- Rotas públicas de mercado só aceitam projetos `ACTIVE`.
- Projetos `SUSPENDED`, `CLOSED`, `REJECTED`, `BANKRUPT` e `PENDING` ficam ocultos das telas comuns.
- Histórico permanece preservado no banco.
- Admin consulta histórico por auditoria e relatórios, não por rotas públicas.
- Esta regra evita que usuários acessem projetos desligados diretamente pelo ID.


## Feedback de preço na compra inicial

Regras:
- Compra no lançamento inicial altera `Company.currentPrice`.
- Compra no lançamento inicial não cria `Trade`.
- A API retorna `priceBefore`, `priceAfter` e `priceIncrease`.
- O frontend exibe preço antes/depois para evitar confusão visual.
- O gráfico continua usando `initialPrice`, `trades` e `currentPrice`.

## Tradução visual de enums

- Enums internos continuam em inglês.
- Interface exibe traduções em português.
- Selects mantêm value técnico e label traduzido.
- Valores desconhecidos aparecem como valor original para não quebrar tela.
