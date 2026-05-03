# ROADMAP PRIORITÁRIO — UZUMAKI INTERPRISE / RPC EXCHANGE

## Decisão estratégica

A prioridade atual do projeto é fechar o ciclo econômico real da RPC Exchange antes de avançar visual premium, gráfico avançado, simulador avançado ou temporadas.

O objetivo é transformar o MVP em um Beta fechado com economia RP completa, segura, auditável e sustentável.

## Regra central refinada

Empresa gera lucro dentro do RP
→ o dono usa esse lucro para comprar/receber R$ fictício no site pelo fluxo normal da economia
→ com R$ fictício, compra RPC no mercado RPC/R$
→ com RPC real já existente na carteira, injeta no projeto ou compra/recompra o token do projeto
→ o preço muda apenas por compra executada na oferta inicial ou por trade real no mercado secundário
→ tudo fica registrado, auditável e separado da carteira pessoal do dono.

Esta regra substitui qualquer interpretação anterior de que o lucro RP vira RPC automaticamente no caixa do projeto.

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
15. Lucro da empresa dentro do RP não vira RPC automática e não cria crédito institucional livre.
16. Se o dono quiser injetar no projeto, ele precisa usar RPC já existente na própria carteira, obtida pelo fluxo R$ → RPC.
17. O caixa institucional do projeto só deve receber saldo rastreável: taxas já implementadas, transferência real de RPC, recompra/reserva futura ou ajuste administrativo excepcional auditado.
18. Nenhum usuário comum ou dono de projeto pode criar crédito institucional confirmado do nada.
19. Saldo institucional do projeto deve ficar separado do saldo pessoal do fundador.
20. Test Mode é laboratório isolado e não pode afetar saldo real, RPC real, mercado real ou tokens reais.

## Prioridade 1 — Fechar ciclo econômico real da Exchange

### PR 1 — Fluxo de capital R$ → RPC → token/projeto

Objetivo:
Garantir que a entrada de capital para projetos passe pelo fluxo econômico normal, sem criar crédito institucional livre.

Implementar futuramente:
- documentação e UX clara do fluxo R$ fictício → RPC → compra de token;
- confirmação de que RPC usada para injetar no projeto precisa existir na carteira do usuário/dono;
- transferência rastreável de RPC da carteira pessoal para o caixa institucional do projeto, se o produto decidir permitir aporte institucional;
- histórico de aportes com motivo obrigatório;
- autor, IP e user-agent quando disponível;
- separação entre saldo pessoal do dono e saldo institucional do projeto;
- logs administrativos/econômicos;
- auditoria básica.

Não deve:
- criar RPC automática a partir de lucro RP;
- permitir crédito institucional livre por dono/fundador;
- alterar preço da moeda;
- criar trade;
- criar recompra;
- distribuir lucro;
- mexer em supply;
- mexer no simulador.

Critério de aceite:
O sistema deixa claro e auditável que capital do projeto entra por saldo existente: R$ fictício → RPC → compra/injeção, sem creditar a carteira pessoal do dono e sem criar preço falso.

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

### PR 3 — Mercado secundário seguro

Objetivo:
Garantir que o preço de mercado secundário seja formado apenas por negociação real entre participantes.

Implementar futuramente:
- revisar criação, cancelamento e execução de ordens;
- reforçar que ordem criada não move preço;
- reforçar que ordem executada move preço;
- bloquear self-trade;
- auditar preço alterado sem trade;
- manter proteção contra saldo/token negativo.

Regra:
Oferta criada = não altera preço.
Oferta executada = altera preço.

### PR 4 — Caixa institucional rastreável do projeto

Objetivo:
Criar ou consolidar a base contábil institucional dos projetos sem virar mecanismo de criação livre de saldo.

Implementar futuramente:
- caixa/receita institucional do projeto;
- histórico de entradas e saídas;
- origem rastreável do saldo;
- motivo obrigatório;
- autor;
- IP e user-agent quando disponível;
- logs administrativos;
- auditoria básica.

Entradas permitidas:
- taxas do projeto já distribuídas pelo sistema;
- transferência real de RPC da carteira do dono/usuário para o projeto;
- ajuste administrativo excepcional com motivo forte e auditoria;
- futuramente, saldos vindos de recompra, reserva ou distribuição conforme regras próprias.

Não deve:
- transformar lucro RP externo em RPC automática;
- permitir que fundador crie crédito institucional confirmado do nada;
- alterar preço;
- criar trade;
- criar ordem;
- alterar supply.

### PR 5 — Programa oficial de recompra com RPC existente

Objetivo:
Permitir que projetos usem RPC real já existente para recomprar o próprio token.

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

### PR 6 — Reserva de tokens recomprados

Objetivo:
Criar reserva institucional para tokens recomprados.

Implementar futuramente:
- tokens recomprados saem dos vendedores;
- entram na reserva do projeto;
- não vão para carteira pessoal do dono;
- podem futuramente ser queimados, mantidos bloqueados, usados em evento ou nova oferta controlada.

Regra inicial:
Tokens recomprados ficam bloqueados na reserva do projeto.

### PR 7 — Distribuição para holders, se mantida

Objetivo:
Permitir que holders ganhem RPC sem precisar vender tokens, mas somente usando RPC rastreável e já existente.

Implementar futuramente:
- snapshot de holders;
- cálculo proporcional;
- pagamento em RPC;
- extrato para usuário;
- logs;
- proteção contra manipulação.

Regra:
Distribuição não cria RPC nova. Ela usa saldo já existente no caixa institucional do projeto.

### PR 8 — Política da RPC

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

### PR 9 — Painel de auditoria econômica

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
- admin mexendo em saldo sem motivo;
- crédito institucional sem origem rastreável.

### PR 10 — Simulador do ciclo completo

Objetivo:
Depois de fechar a economia real, evoluir o Test Mode para simular o ciclo completo.

Simular:
- fluxo R$ → RPC → token;
- oferta inicial;
- compra de token;
- mercado secundário;
- recompra;
- distribuição de lucro, se mantida;
- reserva;
- queima;
- venda em massa;
- baixa liquidez;
- entrada de baleia;
- saída de baleia.

### PR 11 — UX funcional

Objetivo:
Melhorar clareza e segurança de uso antes do visual premium.

Implementar futuramente:
- mensagens claras;
- anti-clique duplo;
- preview de impacto;
- aviso de risco;
- estado vazio correto;
- explicação de mercado primário/secundário;
- explicação de fluxo R$ → RPC → token;
- explicação de recompra/distribuição/reserva.

### PR 12 — Visual premium

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

1. Fluxo de capital R$ → RPC → token/projeto.
2. Mercado primário correto.
3. Mercado secundário seguro.
4. Caixa institucional rastreável do projeto.
5. Programa de recompra com RPC existente.
6. Reserva de tokens recomprados.
7. Distribuição para holders, se mantida.
8. Política da RPC.
9. Auditoria econômica.
10. Simulador do ciclo completo.
11. UX funcional.
12. Visual premium.

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
- não criar liquidez falsa;
- não criar crédito institucional livre sem origem rastreável.
