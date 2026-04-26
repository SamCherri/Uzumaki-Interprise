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

## Fase atual (MVP - bloco 2)

Implementado até esta fase:

1. Estrutura inicial frontend/backend e autenticação.
2. Fluxo econômico central da moeda fictícia: ADM Chefe da Moeda → Tesouraria → Corretor → Usuário.
3. Endpoints de emissão, transferências e histórico com validações de saldo e permissões.
4. Registro obrigatório de CoinIssuance, CoinTransfer, Transaction e AdminLog nas ações sensíveis.
5. Atualização do painel Admin com emissão, transferência para corretor e histórico.
6. Novo painel do Corretor com saldo, repasse ao usuário e histórico básico.


## Fluxo da moeda fictícia (Fase 2)

A moeda virtual agora segue obrigatoriamente este caminho:

1. **COIN_CHIEF_ADMIN / SUPER_ADMIN** emite moeda para a Tesouraria Central.
2. Tesouraria Central envia saldo para um usuário com cargo **VIRTUAL_BROKER**.
3. Corretor virtual repassa saldo para o usuário final.
4. Cada etapa gera registro permanente para auditoria.

### Endpoints econômicos criados

- `GET /api/admin/treasury/balance` → consulta saldo da Tesouraria.
- `POST /api/admin/treasury/issuance` → emissão de moeda fictícia para Tesouraria.
- `POST /api/admin/treasury/transfer-to-broker` → transferência da Tesouraria para corretor.
- `GET /api/admin/coin-history` → histórico de emissões e transferências.
- `GET /api/broker/balance` → saldo disponível do corretor.
- `POST /api/broker/transfer-to-user` → corretor repassa moeda ao usuário.
- `GET /api/broker/history` → histórico de repasses do corretor.

### Regras de permissão e segurança

- Usuário comum não acessa endpoints administrativos.
- Apenas `COIN_CHIEF_ADMIN` ou `SUPER_ADMIN` pode emitir moeda.
- Apenas corretor virtual (`VIRTUAL_BROKER`) pode repassar moeda ao usuário.
- Tesouraria nunca fica negativa.
- Saldo de corretor nunca fica negativo.
- Toda ação sensível registra `AdminLog` com motivo, valores e origem da chamada.

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
4. Confirmar que backend responde em `/health`.

## Observações importantes

- **Não usar SQLite como solução final** neste projeto.
- **Não commitar `.env` real** com segredos.
- Em produção, preferir variáveis no painel do Railway.
- Se `npm install` falhar por bloqueio externo (ex.: erro 403 de registry), registrar o incidente e manter os arquivos de configuração corretos.


## Checklist de mergeabilidade da PR #1

Se o GitHub mostrar `mergeable: false`, normalmente é por branch desatualizada ou conflito com `main`.

Passos recomendados para o mantenedor (com acesso ao remoto):

```bash
git fetch origin
git checkout work
git rebase origin/main
# resolver conflitos, se aparecerem
git push --force-with-lease
```

Alternativa sem rebase:

```bash
git fetch origin
git checkout work
git merge origin/main
# resolver conflitos, se aparecerem
git push
```

Após isso, revalidar no GitHub se a PR voltou para `mergeable: true`.
