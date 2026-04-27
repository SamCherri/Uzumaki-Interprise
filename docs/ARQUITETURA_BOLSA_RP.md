# ARQUITETURA_BOLSA_RP

## 1) Visão geral

A **Bolsa Virtual RP** é uma plataforma de **simulação econômica fictícia** para roleplay (RP), com negociação de cotas/ações fictícias entre usuários.

Escopo obrigatório da simulação:
- sem dinheiro real;
- sem cripto real;
- sem blockchain;
- sem saque real;
- sem Pix;
- sem cartão;
- sem gateway de pagamento;
- sem promessa de lucro.

Todo o funcionamento é interno à plataforma e serve apenas para experiência de jogo/simulação.

> Referências como Binance, HollaEx Kit, OpenDAX/Peatio, OpenCEX e OpenDAX BaseApp são **apenas conceituais** (arquitetura, fluxo, telas e módulos), sem cópia direta de código e sempre com verificação de licença.

---

## 2) Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + TypeScript + Fastify
- **Banco de dados:** PostgreSQL
- **ORM:** Prisma
- **Autenticação:** JWT
- **Deploy:** Railway
- **Diretriz de interface:** mobile-first

---

## 3) Módulos principais

### Módulos atuais (núcleo já existente)
- Usuários
- Roles/permissões
- Carteira fictícia
- Tesouraria
- Corretores virtuais
- Empresas fictícias
- Cotas/ações fictícias
- Livro de ofertas
- Ordens
- Matching engine
- Trades
- Histórico
- Painel admin

### Módulos desejados/expansão
- Logs administrativos mais avançados
- Gráficos mais completos
- PWA/app instalável

---

## 4) Fluxo econômico atual

1. Admin cria moeda fictícia na tesouraria.
2. Admin envia moeda para corretor.
3. Corretor envia moeda para usuário.
4. Usuário compra cotas.
5. Usuário cria ordens de compra/venda.
6. Matching engine executa trades compatíveis.
7. Carteiras/holdings são atualizadas.
8. Logs e registros operacionais são armazenados.

---

## 5) Fluxo desejado futuro

1. Introduzir **carteira da plataforma** para consolidar receitas da operação.
2. Criar **carteira da empresa automaticamente** no momento de aprovação da empresa.
3. Dividir taxas de negociação entre plataforma e empresa (regra parametrizável).
4. Acumular receita da empresa em conta própria.
5. Em fase futura, habilitar rotinas fictícias de retirada/reinvestimento/dividendos (sem dinheiro real).

---

## 6) Regras de segurança

- Não permitir saldo negativo de moeda fictícia.
- Não permitir cotas negativas.
- Toda operação financeira deve ocorrer em transação atômica.
- Toda ação administrativa deve gerar log.
- Admin não pode alterar saldo sem justificativa registrada.
- Rotas administrativas exigem role/permissão adequada.
- Frontend não deve exibir áreas Admin/Corretor para usuários sem permissão.

---

## 7) Matching engine

Regras operacionais da simulação:

- Ordem de compra cruza com a menor ordem de venda compatível.
- Ordem de venda cruza com a maior ordem de compra compatível.
- Execução parcial é permitida quando houver liquidez parcial.
- Cada execução gera registro de trade.
- Atualização de carteiras e holdings ocorre em transação Prisma para consistência.

---

## 8) Interface (diretriz de UX)

- Estratégia **mobile-first**.
- Tela pública limitada a login/cadastro.
- Home logada simples e objetiva.
- Mercado apresentado em cards.
- Tela da empresa focada na cota (sem excesso de distrações).
- Gráfico em destaque.
- Botões **Comprar**/**Vender** grandes e claros.
- Livro, ordens e histórico em abas.
- Linguagem simples para usuário comum (evitar jargão técnico quando possível).

---

## 9) PWA

Objetivo da fase de PWA:

- permitir instalar no celular como aplicativo;
- incluir `manifest`;
- incluir `service worker`;
- adicionar botão **"Instalar aplicativo"**;
- manter escopo sem APK e sem publicação em Play Store nesta fase.

