# ROADMAP PRIORITÁRIO — UZUMAKI INTERPRISE / RPC EXCHANGE

## Decisão estratégica

A prioridade atual do projeto é fechar o ciclo econômico real da RPC Exchange antes de avançar visual premium, gráfico avançado, simulador avançado ou temporadas.

O objetivo é transformar o MVP em um Beta fechado com economia RP completa, segura, auditável e sustentável.

Regra central:

Empresa gera lucro no RP
→ lucro entra no caixa institucional do projeto
→ projeto usa esse saldo para recompra, distribuição, reserva ou expansão
→ holders ganham por valorização real ou distribuição
→ tudo fica registrado, auditável e separado da carteira pessoal do dono.

## Regras econômicas permanentes

1. A RPC Exchange é simulação RP.
2. Não existe dinheiro real, cripto real, blockchain, Pix, cartão, gateway de pagamento ou promessa de lucro real.
3. RPC é a moeda base operacional da plataforma.
4. Tokens/projetos são criados por usuários e aprovados/moderados pela administração.
5. A plataforma não deve criar tokens próprios negociáveis como regra normal.
6. Admin pode criar token manual apenas como exceção administrativa auditada para evento, correção ou teste.
7. Mercado primário e mercado secundário devem ser tratados separadamente.
8. Oferta criada não altera preço.
9. Oferta executada altera preço.
10. Compra da oferta inicial pode alterar preço conforme regra transparente.
11. No mercado secundário, preço oficial só muda por trade real.
12. Injeção de RPC não deve subir gráfico automaticamente.
13. Recompra deve executar contra ordens reais do livro.
14. Moedas recompradas devem ir para reserva institucional do projeto, não para carteira pessoal do dono.
15. Lucro da empresa deve entrar primeiro no caixa institucional do projeto.
16. Saldo institucional do projeto deve ficar separado do saldo pessoal do fundador.
17. Test Mode é laboratório isolado e não pode afetar saldo real, RPC real, mercado real ou tokens reais.

## Prioridade 1 — Fechar ciclo econômico real da Exchange

### PR 1 — Caixa econômico do projeto

Objetivo:
Criar a base contábil institucional dos projetos.

Implementar futuramente:
- caixa/receita institucional do projeto;
- registro de lucro da empresa dentro do RP;
- histórico de entradas e saídas;
- motivo obrigatório;
- autor;
- IP e user-agent quando disponível;
- separação entre saldo pessoal do dono e saldo institucional do projeto;
- logs administrativos;
- auditoria básica.

Não deve:
- alterar preço da moeda;
- criar trade;
- criar recompra;
- distribuir lucro;
- mexer em supply;
- mexer no simulador.

Critério de aceite:
A empresa/projeto consegue registrar lucro RP convertido em RPC no caixa institucional sem creditar a carteira pessoal do dono.

### PR 2 — Mercado primário correto

Objetivo:
Consolidar a regra da oferta inicial.

Implementar futuramente:
- política de oferta inicial;
- curva de preço transparente;
- limite por jogador, se necessário;
- encerramento da oferta inicial;
- transição clara para mercado secundário;
- logs e operações auditáveis.

Regra:
Compra da oferta inicial pode mover preço.
Oferta inicial parada não move preço.
Depois da oferta inicial, preço só muda por trade real no mercado secundário.

### PR 3 — Programa oficial de recompra

Objetivo:
Permitir que projetos usem lucro institucional para recomprar o próprio token.

Implementar futuramente:
- programa de recompra com valor em RPC;
- duração;
- estratégia conservadora, normal ou agressiva;
- execução contra ordens reais de venda;
- bloqueio de self-trade;
- expiração;
- renovação;
- saldo não usado volta para receita/reserva do projeto;
- logs administrativos.

Regra:
Recompra não aumenta preço diretamente.
Preço só sobe se houver trade real executado.

### PR 4 — Reserva de tokens recomprados

Objetivo:
Criar reserva institucional para tokens recomprados.

Implementar futuramente:
- tokens recomprados saem dos vendedores;
- entram na reserva do projeto;
- não vão para carteira pessoal do dono;
- podem futuramente ser queimados, mantidos bloqueados, usados em evento ou nova oferta controlada.

Regra inicial:
Tokens recomprados ficam bloqueados na reserva do projeto.

### PR 5 — Distribuição de lucro para holders

Objetivo:
Permitir que holders ganhem RPC sem precisar vender tokens.

Implementar futuramente:
- snapshot de holders;
- cálculo proporcional;
- pagamento em RPC;
- extrato para usuário;
- logs;
- proteção contra manipulação.

Exemplo:
Empresa lucrou 100.000 RPC:
- 50% recompra;
- 30% distribuição para holders;
- 20% reserva.

### PR 6 — Política da RPC

Objetivo:
Consolidar RPC como moeda base controlada.

Implementar futuramente:
- supply planejado;
- circulação;
- tesouraria;
- emissão;
- painel de supply;
- alertas de emissão;
- logs obrigatórios.

Diretriz:
RPC não é infinita.
RPC deve ser emitida/liberada com controle, motivo e auditoria.

### PR 7 — Painel de auditoria econômica

Objetivo:
Detectar inconsistências econômicas.

Alertas futuros:
- saldo negativo;
- ordem aberta sem saldo travado;
- preço alterado sem trade;
- programa de recompra vencido;
- saldo preso sem destino;
- self-trade;
- distribuição inconsistente;
- reserva negativa;
- emissão sem log;
- admin mexendo em saldo sem motivo.

### PR 8 — Simulador do ciclo completo

Objetivo:
Depois de fechar a economia real, evoluir o Test Mode para simular o ciclo completo.

Simular:
- oferta inicial;
- compra de RPC;
- compra de token;
- mercado secundário;
- recompra;
- distribuição de lucro;
- reserva;
- queima;
- venda em massa;
- baixa liquidez;
- entrada de baleia;
- saída de baleia.

### PR 9 — UX funcional

Objetivo:
Melhorar clareza e segurança de uso antes do visual premium.

Implementar futuramente:
- mensagens claras;
- anti-clique duplo;
- preview de impacto;
- aviso de risco;
- estado vazio correto;
- explicação de mercado primário/secundário;
- explicação de recompra/distribuição/reserva.

### PR 10 — Visual premium

Objetivo:
Somente depois da economia estar fechada.

Implementar futuramente:
- gráfico premium;
- livro de ordens premium;
- dashboard refinado;
- visual mobile melhorado;
- animações;
- experiência estilo exchange.

## Ordem oficial atual

1. Caixa econômico do projeto.
2. Mercado primário correto.
3. Programa de recompra.
4. Reserva de tokens recomprados.
5. Distribuição para holders.
6. Política da RPC.
7. Auditoria econômica.
8. Simulador do ciclo completo.
9. UX funcional.
10. Visual premium.

## Regra para Codex e agentes

Antes de implementar qualquer coisa relacionada a economia, mercado, RPC, projeto, token, simulador, admin, UX estrutural ou roadmap, ler:

1. AGENTS.md
2. docs/CODEX_SKILLS.md
3. docs/ROADMAP_PRIORITARIO.md
4. docs/ARQUITETURA_BOLSA_RP.md
5. docs/AUDITORIA_ATUAL.md

Em caso de conflito:
- código atual vence conversa antiga;
- ROADMAP_PRIORITARIO.md vence docs antigas;
- regra de segurança econômica vence visual;
- não criar preço falso;
- não criar volume falso;
- não criar liquidez falsa.
