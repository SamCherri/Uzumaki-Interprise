# PR #22 — descrição atualizada após 2º commit

## Motivation
- Finalizar a conversão da linguagem pública do produto para **RPC Exchange** sem alterar regras econômicas, schema ou endpoints.
- Corrigir o apontamento de alta prioridade no `seed.ts` para evitar duplicação silenciosa do usuário demo em bases legadas.

## Description
- Mantidas as alterações textuais/visuais da PR #22 (backend + frontend + service worker + auditoria curta).
- No **2º commit**, `backend/prisma/seed.ts` foi ajustado para resolver o usuário demo nesta ordem:
  1. reutiliza `jogador@rpc.exchange.local` se já existir;
  2. se não existir, reaproveita `jogador@bolsavirtual.local` e migra o e-mail para `@rpc.exchange.local`;
  3. só cria novo usuário demo quando nenhum dos dois existe.
- Também foi adicionado `wallet.upsert` para garantir carteira ao usuário demo reaproveitado/migrado.
- Com isso, o comentário de review do seed ficou **outdated/resolvido** pelo 2º commit.

## Testing (reexecutado após 2º commit)

### 1) `npm run typecheck --workspace backend`
**Status:** falhou (erros preexistentes, fora do escopo da correção do seed)

**Log exato:**
```bash
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> backend@0.1.0 typecheck
> tsc --noEmit

src/routes/admin.ts(265,31): error TS7006: Parameter 'account' implicitly has an 'any' type.
src/routes/market.ts(1,10): error TS2305: Module '"@prisma/client"' has no exported member 'MarketOrder'.
src/routes/market.ts(242,40): error TS2694: Namespace '"/workspace/Uzumaki-Interprise/node_modules/.prisma/client/default".Prisma' has no exported member 'MarketOrderUpdateInput'.
src/routes/market.ts(250,40): error TS2694: Namespace '"/workspace/Uzumaki-Interprise/node_modules/.prisma/client/default".Prisma' has no exported member 'MarketOrderUpdateInput'.
src/routes/market.ts(372,54): error TS7006: Parameter 'tx' implicitly has an 'any' type.
src/routes/market.ts(505,57): error TS7006: Parameter 'tx' implicitly has an 'any' type.
src/routes/market.ts(591,55): error TS7006: Parameter 'tx' implicitly has an 'any' type.
src/routes/market.ts(624,55): error TS7006: Parameter 'tx' implicitly has an 'any' type.
src/services/fee-distribution-service.ts(1,10): error TS2305: Module '"@prisma/client"' has no exported member 'FeeSourceType'.
npm error Lifecycle script `typecheck` failed with error:
npm error code 2
npm error path /workspace/Uzumaki-Interprise/backend
npm error workspace backend@0.1.0
npm error location /workspace/Uzumaki-Interprise/backend
npm error command failed
npm error command sh -c tsc --noEmit
```

### 2) `npm run build --workspace backend`
**Status:** falhou (mesma classe de erros preexistentes)

**Log exato:**
```bash
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> backend@0.1.0 build
> tsc -p tsconfig.json

src/routes/admin.ts(265,31): error TS7006: Parameter 'account' implicitly has an 'any' type.
src/routes/market.ts(1,10): error TS2305: Module '"@prisma/client"' has no exported member 'MarketOrder'.
src/routes/market.ts(242,40): error TS2694: Namespace '"/workspace/Uzumaki-Interprise/node_modules/.prisma/client/default".Prisma' has no exported member 'MarketOrderUpdateInput'.
src/routes/market.ts(250,40): error TS2694: Namespace '"/workspace/Uzumaki-Interprise/node_modules/.prisma/client/default".Prisma' has no exported member 'MarketOrderUpdateInput'.
src/routes/market.ts(372,54): error TS7006: Parameter 'tx' implicitly has an 'any' type.
src/routes/market.ts(505,57): error TS7006: Parameter 'tx' implicitly has an 'any' type.
src/routes/market.ts(591,55): error TS7006: Parameter 'tx' implicitly has an 'any' type.
src/routes/market.ts(624,55): error TS7006: Parameter 'tx' implicitly has an 'any' type.
src/services/fee-distribution-service.ts(1,10): error TS2305: Module '"@prisma/client"' has no exported member 'FeeSourceType'.
npm error Lifecycle script `build` failed with error:
npm error code 2
npm error path /workspace/Uzumaki-Interprise/backend
npm error workspace backend@0.1.0
npm error location /workspace/Uzumaki-Interprise/backend
npm error command failed
npm error command sh -c tsc -p tsconfig.json
```

### 3) `npm run typecheck --workspace frontend`
**Status:** passou

### 4) `npm run build --workspace frontend`
**Status:** passou
