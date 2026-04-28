# ARQUITETURA_RPC_EXCHANGE

## 1) Visão geral

A **RPC Exchange** é uma plataforma de **simulação econômica** com experiência visual de exchange de tokens entre usuários, mantendo escopo totalmente fictício/simulado.

Escopo obrigatório da simulação:
- sem dinheiro real;
- sem cripto real;
- sem blockchain;
- sem saque real;
- sem Pix;
- sem cartão;
- sem gateway de pagamento;
- sem promessa de lucro.

Todo o funcionamento é interno à plataforma e serve apenas para experiência de jogo/simulação.

> Referências como Binance, HollaEx Kit, OpenDAX/Peatio, OpenCEX e OpenDAX BaseApp são **apenas conceituais** (arquitetura, fluxo, telas e módulos), sem cópia direta de código e sempre com verificação de licença.

---

## 2) Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + TypeScript + Fastify
- **Banco de dados:** PostgreSQL
- **ORM:** Prisma
- **Autenticação:** JWT
- **Deploy:** Railway
- **Diretriz de interface:** mobile-first

---

## 3) Módulos principais

### Módulos atuais (núcleo já existente)
- Usuários
- Roles/permissões
- Carteira
- Tesouraria
- Corretores virtuais
- Projetos/Mercados
- Tokens
- Livro de ofertas
- Ordens
- Matching engine
- Trades
- Histórico
- Painel admin

### Módulos desejados/expansão
- Logs administrativos mais avançados
- Gráficos mais completos
- PWA/app instalável

---

## 4) Fluxo econômico oficial

1. Admin cria moeda de simulação (RPC) na tesouraria.
2. Admin vende RPC para corretor dentro do RP.
3. No site, admin envia RPC para corretor.
4. Corretor vende RPC para jogador dentro do RP.
5. No site, corretor envia RPC para usuário.
6. Usuário cria projeto/token e solicita listagem.
7. Admin aprova, rejeita, pausa ou suspende listagens (moderação).
8. Aprovado, o sistema cria mercado no formato **TICKER/RPC**.
9. Usuários negociam tokens no mercado (oferta inicial e mercado secundário).
10. Usuário cria ordens de compra/venda (com taxas de trade).
11. Matching engine executa ordens/trades compatíveis.
12. Toda taxa cobrada é distribuída em 50% plataforma e 50% projeto.
13. Usuário solicita saque no site.
14. Valor é bloqueado em `pendingWithdrawalBalance`.
15. Admin paga o usuário dentro do RP.
16. Admin conclui saque no site (ou rejeita, quando necessário).
17. Na conclusão, o RPC pendente é removido definitivamente do sistema; na rejeição/cancelamento, o valor retorna ao saldo disponível.
18. Carteiras/holdings são atualizadas.
19. Logs e registros operacionais são armazenados (`Transaction`, `CompanyOperation`, `AdminLog`, `FeeDistribution`, `WithdrawalRequest`).

Regra estrutural:
- A plataforma não cria tokens/projetos próprios negociáveis.
- RPC é moeda base operacional e não token criado por usuário.

---

## 5) Fluxo de taxas implementado (fase atual)

1. Existe uma carteira única da plataforma (`PlatformAccount`) para receitas de taxas.
2. Cada empresa ativa possui carteira de receita (`CompanyRevenueAccount`).
3. A carteira da empresa nasce no ato de aprovação administrativa (não na solicitação).
4. A distribuição de taxa usa regra fixa de código: 50% plataforma / 50% empresa.
5. A distribuição gera registro em `FeeDistribution` dentro da mesma transação econômica da operação origem.
6. Retirada da receita da empresa ainda não está implementada.

---

## 6) Regras de segurança

- Não permitir saldo negativo de moeda fictícia.
- Não permitir tokens negativos.
- Toda operação financeira deve ocorrer em transação atômica.
- Toda ação administrativa deve gerar log.
- Admin não pode alterar saldo sem justificativa registrada.
- Rotas administrativas exigem role/permissão adequada.
- Frontend não deve exibir áreas Admin/Corretor para usuários sem permissão.

---

## 7) Matching engine

Regras operacionais da simulação:

- Ordem de compra cruza com a menor ordem de venda compatível.
- Ordem de venda cruza com a maior ordem de compra compatível.
- Execução parcial é permitida quando houver liquidez parcial.
- Cada execução gera registro de trade.
- Atualização de carteiras e holdings ocorre em transação Prisma para consistência.

---

## 8) Interface (diretriz de UX)

- Estratégia **mobile-first**.
- Tela pública limitada a login/cadastro.
- Home logada simples e objetiva.
- Mercados apresentados em cards com pares TICKER/RPC.
- Tela do ativo/projeto focada no token (sem excesso de distrações).
- Gráfico em destaque.
- Botões **Comprar**/**Vender** grandes e claros.
- Livro, ordens e histórico em abas.
- Linguagem simples para usuário comum (evitar jargão técnico quando possível).

---

## 9) PWA

Objetivo da fase de PWA:

- permitir instalar no celular como aplicativo;
- incluir `manifest`;
- incluir `service worker`;
- adicionar botão **"Instalar aplicativo"**;
- manter escopo sem APK e sem publicação em Play Store nesta fase.

## Atualização 2026-04-28 — Ferramentas administrativas avançadas
- Rotas `/api/admin/users*` para gerenciamento de usuários, roles e bloqueio.
- Rotas `/api/admin/tokens*` para criação manual de mercado, pausa, reativação, encerramento e exclusão segura.
- Mercado CLOSED cancela ordens abertas com liberação de saldo/tokens bloqueados e bloqueia novas ordens.
