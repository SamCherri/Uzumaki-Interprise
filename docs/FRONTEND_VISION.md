# FRONTEND_VISION.md — Arquitetura visual oficial (mobile-first)

## 1) Estado atual

- A interface atual da RPC Exchange ainda deve ser tratada como **MVP/protótipo visual**.
- Em tarefas de repaginação visual, o frontend **pode e deve** ser reestruturado de forma completa quando solicitado.
- O visual atual **não é final** e não deve ser usado como justificativa para PR superficial.

---

## 2) Objetivo visual

A RPC Exchange deve parecer:
- web app **mobile-first**;
- exchange RP com acabamento premium;
- produto SaaS financeiro de simulação;
- interface limpa, responsiva e organizada.

A RPC Exchange não deve parecer:
- sistema interno antigo;
- app infantil;
- site genérico;
- coleção de cards empilhados sem hierarquia.

Identidade obrigatória:
- simulação econômica RP;
- personalidade visual controlada;
- clareza operacional e leitura rápida em celular.

---

## 3) Arquitetura oficial de componentes/padrões

Toda repaginação estrutural deve considerar estes blocos como padrão oficial:

- `AppShell`
- `MobileTopbar`
- `BottomNav`
- `SideDrawer`
- `BottomSheet`
- `PageShell`
- `PremiumWindow`
- `PremiumCard`
- `MetricCard`
- `SectionTabs`
- `StatusBadge`
- `EmptyState`
- `ActionButton`
- `ConfirmEconomicAction`
- `EconomicNotice`

Regras:
- componente visual novo só é válido se aplicado em tela real;
- componente sem uso prático não conta como entrega de fluxo visual;
- componentes devem preservar feedback de erro/sucesso/loading e confirmações econômicas.

---

## 4) Estrutura mobile obrigatória

Em telas mobile-first, seguir a hierarquia:

1. `BottomNav` com 4 ou 5 destinos principais.
2. `SideDrawer` para destinos secundários.
3. `BottomSheet` para ações contextuais e confirmação/preview.
4. Hero compacto no topo (mensagem curta e útil).
5. Métricas em grid enxuto.
6. Ação principal antes de dados secundários.
7. Histórico/listas depois da ação principal.

Diretrizes adicionais:
- evitar rolagem longa com conteúdo de baixa prioridade acima das ações;
- evitar card dentro de card sem ganho funcional real;
- priorizar toque rápido e leitura clara em telas pequenas.

---

## 5) Navegação oficial por perfil

### Usuário normal
- Início
- Mercados
- Carteira
- RPC/R$
- Menu

### Usuário restrito ao Test Mode
- Teste
- Ranking
- Bug
- Menu

### Drawer por seções
- Principal
- Simulador
- Projetos
- Administração
- Conta

Regras:
- navegação deve refletir apenas telas realmente renderizáveis;
- não exibir item de navegação para rota/tela inexistente;
- mudanças de perfil/permissão não podem quebrar a navegação mobile.

---

## 6) Identidade RP (emojis e badges)

- Emojis/figurinhas são permitidos e recomendados como reforço de contexto RP.
- Emojis devem ficar em `nav-icon-badge`/`rp-badge`.
- Não usar emoji gigante como elemento principal.
- Evitar siglas cruas (`IN`, `MK`, `CT`) quando emoji pequeno + label curta forem mais claros.
- Ícones devem reforçar identidade RP sem infantilizar a interface.

---

## 7) Imagens e marca

- Não usar imagem de baixa qualidade nas áreas principais.
- Evitar `logo-full.png` quando houver fundo quadriculado/poluído.
- Priorizar `BrandLogo` em HTML/CSS para consistência responsiva.
- Monograma `RPC` em CSS é permitido.
- Proibido copiar marca, logo, nome ou identidade visual proprietária de terceiros.

---

## 8) Janelas, modais, sheets e cards

- Evitar duplicação visual e sobreposição de layouts antigos/novos.
- Todo modal/sheet deve ter ação clara (abrir, confirmar/cancelar, fechar).
- `BottomSheet` deve ter:
  - `role="dialog"`;
  - `aria-modal="true"`;
  - fechamento por botão, toque fora e tecla `Escape`.
- Cards devem ter função explícita:
  - métrica;
  - ação;
  - aviso;
  - lista/histórico;
  - confirmação.

---

## 9) Regras contra PR superficial

É proibido em PR visual:
- criar componente sem uso real;
- adicionar CSS sem tela afetada;
- prometer na descrição algo que o código não faz;
- botão sem efeito visível;
- aba sem conteúdo real;
- duplicar layout antigo com layout novo sem remoção planejada;
- quebrar o caso de usuário restrito ao Test Mode;
- esconder erro de API;
- usar dados mockados para simular comportamento de produção.

---

## 10) Checklist obrigatório para PR visual

Responder explicitamente na PR:

1. Qual tela real mudou?
2. Qual layout antigo foi substituído?
3. Há duplicação visual remanescente?
4. Mobile foi validado?
5. Usuário normal funciona?
6. Admin funciona?
7. Test Mode restrito funciona?
8. BottomNav aponta só para telas renderizáveis?
9. Drawer fecha ao tocar fora?
10. BottomSheet fecha com `Escape`?
11. Typecheck passou?
12. Build passou?

Se qualquer item ficar pendente, a PR deve declarar pendência de forma objetiva.

---

## Regra de governança

A partir deste documento, toda PR de repaginação visual/frontend estrutural da RPC Exchange deve seguir `docs/FRONTEND_VISION.md` como referência obrigatória.
