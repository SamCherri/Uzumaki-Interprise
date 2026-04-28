# ARQUITETURA_UZUMAKI_EXCHANGE

## 1) Visão geral

A **Uzumaki Exchange** é uma plataforma de **simulação econômica** com experiência visual de exchange de tokens entre usuários, mantendo escopo totalmente fictício/simulado.

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

## 4) Fluxo econômico atual

1. Admin cria moeda de simulação (RPC) na tesouraria.
2. Admin envia moeda para corretor.
3. Corretor envia moeda para usuário.
4. Usuário compra tokens (com taxa de compra).
5. Usuário cria ordens de compra/venda (com taxas de trade).
6. Matching engine executa ordens/trades compatíveis.
7. Toda taxa cobrada é distribuída em 50% plataforma e 50% empresa.
8. Carteiras/holdings são atualizadas.
9. Logs e registros operacionais são armazenados (`Transaction`, `CompanyOperation`, `AdminLog`, `FeeDistribution`).

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

