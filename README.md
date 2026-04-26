# Bolsa Virtual RP

Projeto de **simulação econômica fictícia** com moeda virtual, cotas virtuais e empresas fictícias em uma bolsa simulada.

> Ambiente fictício de simulação econômica. Nenhum valor possui conversão para dinheiro real.

## Estrutura

- `frontend/`: React + Vite + TypeScript (painéis iniciais).
- `backend/`: Fastify + Prisma + TypeScript (API e regras de backend).
- `docs/`: documentação principal da simulação.

## Requisitos

- Node.js 20+
- PostgreSQL 15+

## Setup rápido

```bash
cp .env.example .env # local apenas
npm install
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend
npm run prisma:seed --workspace backend
npm run dev
```

## Scripts principais

```bash
npm run dev
npm run dev:backend
npm run dev:frontend
npm run build
npm run lint
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

## Observações de segurança

- Não commitar `.env` com segredo real.
- Validar permissões no backend.
- Regras econômicas críticas devem permanecer no servidor.
