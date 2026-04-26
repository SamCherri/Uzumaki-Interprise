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

## Fase atual (MVP - bloco 1)

Implementado neste bloco:

1. Estrutura inicial frontend/backend.
2. Schema Prisma inicial (roles, permissões, usuário, carteira, tesouraria, corretor, logs e transações).
3. Seed com cargos e permissões iniciais.
4. Cadastro e login com senha criptografada e JWT.
5. Criação automática de carteira fictícia no cadastro.
6. APIs iniciais para perfil, carteira e painel admin básico.
7. Telas iniciais: Login, Cadastro, Dashboard do Usuário e Painel Admin básico.

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
   - **Start Command:** `npm run prisma:migrate && npm run prisma:seed && npm run start`
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
   - **Start Command:** `npm run dev -- --host 0.0.0.0 --port $PORT` (MVP inicial)
4. Variável do frontend:
   - `VITE_API_URL` = URL pública do backend (ex.: `https://seu-backend.up.railway.app`)

### 5) Ajustar CORS (backend)

No backend, `WEB_ORIGIN` controla quem pode acessar a API. Se tiver mais de uma origem, use vírgula.

Exemplo:

```env
WEB_ORIGIN="https://seu-frontend.up.railway.app,https://www.seudominio.com"
```

### 6) Rodar migration e seed

No backend em produção, rode:

```bash
npm run prisma:migrate
npm run prisma:seed
```

No fluxo acima, isso já está no `Start Command`.

### 7) Validar funcionamento

1. Abrir frontend.
2. Cadastrar usuário.
3. Fazer login.
4. Confirmar que backend responde em `/health`.

## Observações importantes

- **Não usar SQLite como solução final** neste projeto.
- **Não commitar `.env` real** com segredos.
- Em produção, preferir variáveis no painel do Railway.
- Se `npm install` falhar por bloqueio externo (ex.: erro 403 de registry), registrar o incidente e manter os arquivos de configuração corretos.
