# Bolsa Virtual RP

Projeto de **simulação econômica fictícia** com moeda virtual, cotas virtuais e empresas fictícias em uma bolsa simulada.

> Ambiente fictício de simulação econômica. Nenhum valor possui conversão para dinheiro real.

## Banco oficial do projeto

O banco oficial é **PostgreSQL/Postgres** com **Prisma ORM** usando `DATABASE_URL`.

- Provider Prisma: `postgresql`.
- Arquivo: `backend/prisma/schema.prisma`.
- Variável obrigatória: `DATABASE_URL`.

## Estrutura

- `frontend/`: React + Vite + TypeScript (painéis iniciais).
- `backend/`: Fastify + Prisma + TypeScript (API e regras de backend).
- `docs/`: documentação principal da simulação.

## Requisitos

- Node.js 20+
- PostgreSQL 15+

## Variáveis de ambiente

Use `.env.example` como referência.

### Backend

- `NODE_ENV`
- `PORT` (Railway injeta automaticamente em produção)
- `DATABASE_URL` (PostgreSQL)
- `JWT_SECRET`
- `WEB_ORIGIN` (origens permitidas no CORS, separadas por vírgula)

### Frontend

- `VITE_API_URL` (URL pública do backend)

## Setup local

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate:dev --workspace backend
npm run prisma:seed
npm run dev
```

## Scripts principais

```bash
npm run install:all         # instala dependências dos workspaces
npm run lint                # lint dos workspaces
npm run typecheck           # validação TypeScript dos workspaces
npm run prisma:generate     # gera Prisma Client (backend)
npm run prisma:migrate      # aplica migrations em produção (backend)
npm run prisma:seed         # popula dados iniciais (backend)
npm run build               # build backend + frontend
npm run start:backend       # sobe backend em produção
```

## Fase atual (MVP - bloco 4A: livro de ofertas e matching simples)

Implementado nesta fase:

1. Solicitação de empresas fictícias por usuários autenticados, com validações de percentuais, taxas e ticker único.
2. Limites administrativos fixos no backend (documentados para virar configuração dinâmica futuramente):
   - taxa máxima de compra: 5%;
   - taxa máxima de venda: 5%;
   - oferta pública mínima: 10%;
   - percentual máximo do dono: 90%.
3. Fluxo administrativo de empresas:
   - listar pendentes;
   - aprovar;
   - rejeitar;
   - suspender.
4. Aprovação de empresa gera automaticamente:
   - posição inicial de cotas do dono;
   - estoque da oferta inicial;
   - logs administrativos e operação de auditoria.
5. Compra de cotas da oferta inicial:
   - cálculo de custo bruto, taxa e custo total;
   - bloqueio por saldo insuficiente;
   - bloqueio por falta de cotas na oferta;
   - atualização de carteira e holdings;
   - registro em `Transaction`, `CompanyOperation` e `AdminLog`.
6. Dashboard do usuário atualizado com holdings e empresas investidas.
7. Livro de ofertas com ordens limitadas de compra e venda entre usuários.
8. Ordens a mercado (compra e venda) com execução parcial e proteção de slippage.
9. Matching engine simples:
   - compra limitada cruza menor preço vendedor (FIFO por empate);
   - venda limitada cruza maior preço comprador (FIFO por empate);
   - ordens a mercado consomem livro respeitando tolerância.
10. Bloqueio de recursos:
   - compra limitada bloqueia saldo em carteira (`availableBalance -> lockedBalance`);
   - venda limitada bloqueia cotas (retiradas da holding até execução/cancelamento).
11. Cancelamento de ordem limitada liberando saldo/cotas bloqueadas.
12. Registro de trades na tabela `Trade`.
13. Atualização de preço atual da empresa pelo último trade executado.
14. Registro de auditoria (`Transaction`, `CompanyOperation`, `AdminLog`) no fluxo de negociação.

## Endpoints principais da Fase 4A

Empresas:
- `POST /api/companies/request`
- `GET /api/companies`
- `GET /api/companies/:id`
- `GET /api/admin/companies/pending`
- `POST /api/admin/companies/:id/approve`
- `POST /api/admin/companies/:id/reject`
- `POST /api/admin/companies/:id/suspend`

Cotas e carteira:
- `POST /api/companies/:id/buy-initial-offer`
- `GET /api/me/holdings`

Mercado secundário:
- `POST /api/market/orders` (ordem limitada BUY/SELL)
- `GET /api/market/orders/me`
- `GET /api/market/companies/:companyId/order-book`
- `POST /api/market/orders/:id/cancel`
- `POST /api/market/companies/:companyId/buy-market`
- `POST /api/market/companies/:companyId/sell-market`
- `GET /api/market/companies/:companyId/trades`

## Observações importantes da simulação

- Este projeto é exclusivamente uma simulação fictícia.
- Não há dinheiro real, saque real, criptoativo real, investimento real ou promessa de lucro real.
- Não foi implementado nesta fase:
  - gráfico candlestick.

## Deploy no Railway

Passo a passo simples para quem não é técnico:

### 1) Criar o projeto

1. Entre no Railway e clique em **New Project**.
2. Conecte este repositório (`SamCherri/Uzumaki-Interprise`).

### 2) Criar serviço PostgreSQL

1. Dentro do projeto, clique em **Add Service**.
2. Escolha **Database > PostgreSQL**.
3. O Railway cria automaticamente a variável `DATABASE_URL` do Postgres.

### 3) Criar serviço Backend

1. Clique em **Add Service > GitHub Repo** e selecione este repositório.
2. Configure **Root Directory** para `backend`.
3. Configure os comandos:
   - **Build Command:** `npm install && npm run prisma:generate && npm run build`
   - **Start Command:** `npm run start`
4. Variáveis do backend:
   - `DATABASE_URL` = valor do Postgres (copiar/colar da aba Variables ou Reference Variable)
   - `JWT_SECRET` = segredo forte
   - `WEB_ORIGIN` = URL pública do frontend (ex.: `https://seu-frontend.up.railway.app`)
   - `PORT` = não precisa fixar; Railway injeta automaticamente

### 4) Criar serviço Frontend

1. Clique em **Add Service > GitHub Repo**.
2. Configure **Root Directory** para `frontend`.
3. Comandos:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run preview -- --port $PORT`
4. Variável do frontend:
   - `VITE_API_URL` = URL pública do backend (ex.: `https://seu-backend.up.railway.app`)

### 5) Ajustar CORS (backend)

No backend, `WEB_ORIGIN` controla quem pode acessar a API. Se tiver mais de uma origem, use vírgula.

Exemplo:

```env
WEB_ORIGIN="https://seu-frontend.up.railway.app,https://www.seudominio.com"
```

### 6) Rodar migration e seed

No backend em produção, rode **separadamente**:

```bash
npm run prisma:migrate
```

Depois, execute o seed **apenas uma vez no bootstrap inicial**:

```bash
npm run prisma:seed
```

### 7) Validar funcionamento

1. Abrir frontend.
2. Cadastrar usuário.
3. Fazer login.
4. Solicitar empresa fictícia ou comprar cotas da empresa demo.
5. Confirmar que backend responde em `/health`.

## Observações finais

- Não commitar `.env` real com segredos.
- Em produção, preferir variáveis no painel do Railway.
- Se `npm install` falhar por bloqueio externo (ex.: erro 403 de registry), registrar o incidente na PR.
