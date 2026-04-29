# AGENTS.md — Instruções permanentes para agentes de código

Este repositório contém a RPC Exchange, uma ferramenta de simulação/interpretação de exchange para RP.

A RPC Exchange não envolve dinheiro real, cripto real, blockchain, Pix, cartão, gateway de pagamento ou promessa de lucro.

## Regra principal

Quando uma tarefa pedir funcionalidade completa, tela completa, redesenho, auditoria, fluxo de produto ou módulo novo, não entregar apenas ajustes pequenos.

A PR deve implementar o fluxo inteiro solicitado ou declarar claramente o que ficou pendente.

## Antes de alterar código

O agente deve:

1. Ler este arquivo.
2. Ler docs/CODEX_SKILLS.md.
3. Identificar qual skill aplicar.
4. Listar mentalmente os arquivos afetados.
5. Preservar funcionalidades existentes.
6. Evitar mudanças fora do escopo.
7. Rodar os comandos de validação adequados.

## Proibido

- Remover funcionalidades sem autorização.
- Alterar taxa 50/50 sem autorização.
- Alterar matching engine sem autorização.
- Criar dinheiro real, Pix, cartão, gateway, cripto real ou blockchain.
- Criar preço falso.
- Criar volume falso.
- Criar liquidez falsa.
- Usar Math.random para preço, volume, liquidez ou gráfico de mercado.
- Criar botão sem função.
- Criar aba sem conteúdo real.
- Criar interface que prometa recurso inexistente.
- Copiar marca, logo, nome ou identidade visual proprietária de terceiros.
- Entregar descrição de PR prometendo algo que o código não faz.

## Obrigatório em toda PR

A descrição da PR deve conter:

- O que foi implementado.
- O que não foi implementado.
- Arquivos alterados.
- Comandos executados.
- Confirmação se houve ou não backend.
- Confirmação se houve ou não migration.
- Confirmação se houve ou não alteração econômica.
- Pendências futuras, se existirem.

## Comandos comuns

Frontend:

npm run typecheck --workspace frontend
npm run build --workspace frontend

Backend:

npm run prisma:generate --workspace backend
npm run typecheck --workspace backend
npm run build --workspace backend

## Regra de entrega

Não finalizar PR com:
- typecheck ignorado;
- build ignorado;
- aba falsa;
- botão falso;
- recurso pela metade sem declarar pendência;
- dados falsos;
- descrição desatualizada.
