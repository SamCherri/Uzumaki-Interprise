# AUDITORIA_ATUAL

Auditoria consolidada do estado atual da **RPC Exchange**, mantendo o projeto existente (sem recriação do zero).

## 1) Implementado

- ✅ fluxo mobile;
- ✅ PWA (manifest + service worker), quando habilitado no frontend;
- ✅ interface moderna nas telas principais já entregues;
- ✅ controle visual por perfil (Admin/Corretor/Usuário);
- ✅ autenticação, carteira, ordens, livro de ofertas, matching engine e histórico;
- ✅ carteiras de taxa (`PlatformAccount` e `CompanyRevenueAccount`) com distribuição 50/50 registrada em `FeeDistribution`.
- ✅ módulo de saque manual (`WithdrawalRequest`) com saldo pendente em carteira e decisão administrativa (processar/concluir/rejeitar).

## 2) Parcial

- ✅ revisão final de nomenclatura pública para RPC Exchange;
- ⚠️ depósito por solicitação direta de usuário ainda não implementado (entrada segue por Admin/Corretor);
- ⚠️ painel admin avançado;
- ⚠️ gráficos avançados (períodos, volume e leitura mais rica);
- ⚠️ ranking de mercados;
- ⚠️ carteira da plataforma (visão administrativa expandida);
- ⚠️ uso/retirada da receita dos projetos;
- ⚠️ possível renomeação interna futura de Company/Shares para Project/Token.

## 3) Próximos passos recomendados

- ✅ limpeza de termos antigos no frontend;
- revisar tela de criação para usar "Criar token" e "Solicitar listagem";
- revisar mercados para reforçar pares dinâmicos `TICKER/RPC` e evitar pares fixos/oficiais;
- ✅ linguagem admin como moderação de listagens;
- validar que admin não aparece como criador de token/projeto.
