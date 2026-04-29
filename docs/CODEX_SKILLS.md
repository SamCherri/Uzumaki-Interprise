# CODEX_SKILLS.md — Skills técnicas para trabalhar na RPC Exchange

Este documento define como o Codex deve atuar conforme o tipo de tarefa.

==================================================
Skill 1 — Product Architect
==================================================

## Quando usar

Use esta skill quando a tarefa envolver:

- regra de negócio;
- fluxo de produto;
- nova mecânica;
- economia RP;
- compra/venda;
- saque;
- corretor;
- admin;
- projeto/token;
- experiência completa.

## Responsabilidades

- Entender o fluxo inteiro antes de alterar código.
- Não implementar solução parcial.
- Não criar telas falsas.
- Identificar impacto em frontend, backend, banco, permissões e auditoria.
- Preservar regras existentes.
- Documentar pendências.

## Checklist

Antes de finalizar, verificar:

- O fluxo começa e termina corretamente?
- Existe permissão correta?
- Existem mensagens de erro/sucesso?
- Alguma regra econômica foi alterada sem autorização?
- A descrição da PR explica o impacto?

==================================================
Skill 2 — Frontend Mobile-First Developer
==================================================

## Quando usar

Use esta skill para:

- telas;
- UX;
- layout;
- mercado;
- carteira;
- admin;
- corretor;
- saque;
- painel do dono;
- compra/venda.

## Obrigatório

- Priorizar celular.
- Botões grandes.
- Espaçamento confortável.
- Abas funcionais.
- Estados vazios.
- Estados de erro.
- Mensagens de sucesso.
- Textos em português.
- Visual consistente com RPC Exchange.
- Não copiar marca de terceiros.

## Proibido

- Criar aba sem função.
- Criar botão sem ação.
- Criar dado falso.
- Criar preço falso.
- Criar volume falso.
- Criar liquidez falsa.
- Usar Math.random para simular mercado.

## Checklist

Antes de finalizar:

- A tela funciona no celular?
- A tela continua aceitável no desktop?
- Todas as abas mudam conteúdo real?
- Todos os botões funcionam?
- Busca/filtro realmente filtra?
- Estado vazio existe?
- Erro aparece?
- Sucesso aparece?
- Build frontend passa?

==================================================
Skill 3 — Backend Economic Developer
==================================================

## Quando usar

Use esta skill para:

- saldo;
- carteira;
- compra;
- venda;
- ordens;
- matching engine;
- saque;
- corretor;
- tesouraria;
- taxa;
- boost;
- admin alterando saldo.

## Obrigatório

- Usar Prisma transaction em movimentações financeiras.
- Impedir saldo negativo.
- Impedir token negativo.
- Criar Transaction quando houver movimentação de carteira.
- Criar AdminLog em ação sensível.
- Validar permissões por role.
- Não confiar apenas no frontend.
- Preservar taxa 50/50.
- Preservar regra de simulação/RP.

## Checklist econômico

Verificar:

- Wallet.availableBalance.
- Wallet.lockedBalance.
- Wallet.pendingWithdrawalBalance.
- CompanyHolding.shares.
- CompanyRevenueAccount.
- PlatformAccount.
- TreasuryAccount.
- BrokerAccount.
- AdminLog.
- Transaction.
- CoinTransfer.
- CompanyOperation.

==================================================
Skill 4 — Technical Auditor
==================================================

## Quando usar

Use esta skill para:

- auditoria geral;
- bug hunt;
- revisar PR;
- procurar falhas de permissão;
- procurar inconsistência econômica;
- encontrar tela quebrada;
- encontrar typecheck falhando.

## Obrigatório

Para cada problema:

- arquivo;
- função/trecho;
- severidade;
- risco;
- correção aplicada;
- pendência, se não corrigir.

## Severidades

- CRÍTICO: saldo, permissão, segurança, perda de dados.
- ALTO: compra/venda, saque, admin, corretor quebrado.
- MÉDIO: UX confusa, dado desatualizado, fluxo incompleto.
- BAIXO: texto, estilo, pequeno ajuste visual.
- MELHORIA: refinamento futuro.

==================================================
Skill 5 — PR Reviewer
==================================================

## Quando usar

Use esta skill antes de finalizar qualquer PR.

## Obrigatório revisar

- A PR implementa o que foi pedido?
- A PR ficou pequena demais para o escopo?
- A descrição promete algo que o código não faz?
- Alguma aba não funciona?
- Algum botão não funciona?
- Algum dado é falso?
- Alguma regra econômica foi alterada?
- Alguma funcionalidade foi removida?
- Os comandos foram rodados?
- A PR precisa de migration?
- A descrição está atualizada?

## Regra

Se encontrar problema, corrigir antes de finalizar.

==================================================
Skill 6 — Technical Documenter
==================================================

## Quando usar

Use esta skill quando alterar:

- regra econômica;
- fluxo admin;
- fluxo corretor;
- saque;
- boost;
- visibilidade de projeto;
- compra/venda;
- permissões;
- deploy;
- Railway;
- banco;
- migrations.

## Obrigatório documentar

- O que mudou.
- Como funciona.
- O que não deve ser feito.
- Como testar.
- Pendências futuras.
