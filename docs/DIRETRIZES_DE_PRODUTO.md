# Diretrizes de Produto — RPC Exchange

## 1. Posicionamento
- O produto deve parecer uma exchange moderna de tokens.
- A experiência após login deve ser realista e imersiva.
- O sistema continua sendo apenas uma ferramenta de interpretação/simulação para RP.

## 2. Aviso de simulação
- O aviso principal deve aparecer na tela pública de login/cadastro.
- Texto sugerido:
  - "Esta é uma ferramenta de simulação/interpretação de uma exchange. Nenhum valor possui conversão para dinheiro real."
  - "Sem cripto real, sem blockchain, sem Pix, sem cartão e sem gateway de pagamento."
- Após login, evitar repetir avisos grandes em todas as telas.
- Pode haver aviso discreto em rodapé ou área institucional, mas sem poluir a experiência.

## 3. Linguagem do app
Usar:
- RPC Exchange
- Depósito (quando for operação administrativa)
- Saque
- Corretor
- Mercados
- Tokens
- Ativos
- Carteira
- Comprar
- Vender
- Ordens
- Histórico
- Livro de ofertas
- RPC
- Pares como TOKEN/RPC, ABC/RPC e XYZ/RPC (dinâmicos)

Evitar na interface principal logada:
- fictício em todo card;
- RP em todo título;
- cotas;
- ações;
- empresa quando estiver falando do ativo negociável;
- linguagem excessivamente técnica.

## 4. Moeda base
- A moeda base visual será RPC.
- Exemplo:
  - Saldo: 10.000 RPC
  - Preço: 1,25 RPC
  - Total: 500 RPC
  - Par: TOKEN/RPC

## 5. Tela pública
A tela pública deve deixar claro:
- é simulação;
- não há dinheiro real;
- não há cripto real;
- não há blockchain.

## 6. Tela logada
A tela logada deve parecer uma exchange:
- mercados;
- carteira;
- ativos;
- gráfico;
- comprar/vender;
- livro de ofertas;
- ordens;
- histórico.
- Para saque manual, exibir orientação curta: "Após solicitar o saque, aguarde o ADM concluir a entrega dentro do RP."

## 7. Restrições permanentes
Nunca implementar:
- dinheiro real;
- saque real;
- Pix;
- cartão;
- gateway de pagamento;
- blockchain;
- cripto real;
- promessa de lucro.

## 8. Diretriz para futuras PRs
Toda PR visual deve respeitar:
- mobile-first;
- botões grandes;
- cards modernos;
- pares TICKER/RPC;
- linguagem simples;
- tela de ativo focada;
- menos informação por tela.

## 9. Regra permanente — Tokens/projetos são criados por usuários

- Usuários criam projetos/tokens e solicitam listagem.
- O token só entra no mercado depois da aprovação.
- O admin não cria tokens: admin apenas aprova, rejeita, pausa ou suspende listagens.
- A plataforma hospeda o mercado e controla negociações, sem criar tokens próprios negociáveis.
- Cada listagem aprovada gera mercado no formato **TICKER/RPC**.
- Evitar pares fixos/oficiais no texto (não usar UZBK/RPC, SAMU/RPC ou POLI/RPC como padrão do produto).

## Diretriz complementar — administração avançada
- Priorizar encerramento de mercado (CLOSED) ao invés de hard delete quando houver histórico econômico.
- Permitir criação manual de token pelo admin para eventos/correções/testes RP.
- Garantir que toda ação administrativa gere trilha de auditoria em `AdminLog`.
