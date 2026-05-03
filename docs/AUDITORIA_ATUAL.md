# AUDITORIA_ATUAL

Auditoria consolidada do estado atual da **RPC Exchange**, mantendo o projeto existente (sem recriação do zero).

## Estado atual implementado

- Fluxos principais de autenticação, carteira, ordens, matching e histórico estão ativos.
- Distribuição de taxas 50/50 está implementada (`PlatformAccount` e `CompanyRevenueAccount`) com `FeeDistribution`.
- Saque manual por `WithdrawalRequest` com saldo pendente e decisão administrativa está implementado.
- Painéis administrativos de auditoria/relatórios e trilhas de log foram adicionados.

## Decisões legadas

- Referências e mecânicas de boost/injeção com efeito direto de preço são tratadas como **legado/risco econômico**.
- Essas referências permanecem como histórico, mas não são a prioridade estratégica atual.

## Nova prioridade

A prioridade atual é fechar o ciclo econômico real da Exchange, nesta ordem:
1. Caixa institucional do projeto.
2. Mercado primário correto.
3. Recompra real via ordens de mercado.
4. Reserva institucional de tokens recomprados.
5. Distribuição para holders.

Fonte oficial: `docs/ROADMAP_PRIORITARIO.md`.

## Histórico de correções já registradas

## Atualização 2026-04-29 — Impulsão definitiva
## Atualização 2026-04-29 — Segurança econômica no matching multi-fill
- **Severidade:** CRÍTICO.
- **Risco identificado:** inconsistência de saldo/bloqueio quando uma ordem executa em múltiplos fills no mesmo loop de matching, por uso de snapshots antigos de wallet/ordem.
- **Correção aplicada:** revisão completa de `runMatching` para recarregar estado atual da ordem taker a cada fill, debitar `availableBalance`/`lockedBalance` com `updateMany` condicionado (`gte`) e `increment/decrement` atômico, validar bloqueios negativos e interromper com erro claro em inconsistência.
- **Proteções garantidas:** sem `availableBalance` negativo, sem `lockedBalance` negativo, sem `lockedCash` negativo, sem `lockedShares` negativo e reembolso consistente da sobra em ordem limite de compra.
- **Regra econômica preservada:** sem alteração na taxa 50/50 e sem alteração da fórmula de preço/matching econômico.
