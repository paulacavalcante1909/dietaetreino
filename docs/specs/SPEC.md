# Dieta & Treino — Especificação do Produto (v0.4)

> Status: **decisões principais aprovadas** — restam as pendências da seção 9.
> Última atualização: 2026-11-24

---

## 1. Visão

PWA mobile-first, gratuito e aberto ao público, para **registrar a alimentação com o mínimo de toques** e **montar fichas de treino simples**, mostrando em tempo real o progresso do dia contra metas definidas pela própria usuária. Referência funcional: apps do tipo "dieta e treino" (ex.: Growth) — **identidade visual, textos e marca são próprios**.

### Objetivos de sucesso
- Registrar uma refeição completa em **≤ 15 segundos** usando receita/recentes.
- Registrar um alimento por código de barras em **≤ 5 segundos**.
- Montar uma ficha de treino (ex.: Treino A com 6 exercícios) em **≤ 2 minutos**.

### Fora de escopo (v1)
Notificações, modo escuro, outros idiomas, cálculo automático de metas, cronômetro de descanso, registro de carga/execução de treino, atividades aeróbicas e calorias gastas, integração com smartwatch / Google Fit / Apple Saúde, monetização.

---

## 2. Decisões

| # | Tema | Decisão |
|---|------|---------|
| D1 | Público | Aberto ao público, com cadastro e login. |
| D2 | Dados | Salvos no banco do servidor; acessíveis de qualquer aparelho. |
| D3 | Hospedagem | Hospedagem própria com HTTPS (desenvolvimento nesta pasta). |
| D4 | Preço | Gratuito, sem anúncios. |
| D5 | Treino | Ficha básica: Treinos A, B, C, D… com exercícios e séries × repetições (ex.: 4×10). |
| D6 | Exercícios | Biblioteca padrão com imagens + exercícios personalizados. |
| D7 | Cronômetro | Não. |
| D8 | Calorias do treino | Não entram na meta (a ficha não registra gasto calórico na v1). |
| D9 | Base de alimentos | Tabela **TACO** + **Open Food Facts** + cadastro manual. |
| D10 | Metas | Digitadas manualmente pela usuária. |
| D11 | Notificações | Não, por enquanto. |
| D12 | Tema | Somente claro. |
| D13 | Idioma | Somente pt-BR. |

---

## 3. Persona

Pessoa que treina na academia, come muitas vezes as mesmas coisas e usa principalmente o celular. Quer rapidez para registrar e clareza do "quanto falta hoje".

---

## 4. Funcionalidades

### 4.1 Conta
- **US-01** Crio conta com nome, e-mail e senha.
- **US-02** Faço login e continuo logada no aparelho até sair.
- **US-03** Altero minha senha estando logada (informando a senha atual).
- **US-04** Excluo minha conta e todos os meus dados (LGPD).
- Recuperação de senha por e-mail e login com Google: **fora da v1**.

**Critérios de aceite**
- E-mail único; senha com no mínimo 8 caracteres.
- Mensagens de erro claras e em português.
- Aceite dos Termos de Uso e da Política de Privacidade no cadastro.

### 4.2 Metas diárias (manuais)
- **US-05** No primeiro acesso, preencho minhas metas diárias: calorias (kcal), carboidratos (g), proteínas (g), gorduras (g), sódio (mg) e água (ml).
- **US-06** Posso editar as metas a qualquer momento nas configurações.

**Critérios de aceite**
- Campos com valores sugeridos de exemplo (placeholder), mas sem cálculo automático.
- Alterar a meta vale **a partir de hoje**; dias passados mantêm a meta da época.
- Aviso discreto se a soma das calorias dos macros (carb×4 + prot×4 + gord×9) divergir mais de 10% da meta de kcal.

### 4.3 Painel do dia (Home)
- **US-07** Vejo um anel principal de calorias (consumidas / meta / restantes) e barras de carboidratos, proteínas, gorduras e sódio.
- **US-08** Vejo o card de água com botões rápidos **+200 ml**, **+300 ml**, **+500 ml** e quantidade personalizada; posso desfazer o último.
- **US-09** Vejo as refeições do dia com subtotal de kcal e botão "+" em cada uma.
- **US-10** Navego entre dias (setas e seletor de calendário).
- Excedeu a meta → indicador muda para cor de alerta (sem tom punitivo).

### 4.4 Refeições
- Padrão: Café da manhã, Lanche da manhã, Almoço, Lanche da tarde, Jantar, Ceia.
- **US-11** Posso renomear, reordenar, ocultar e criar refeições.
- **US-12** Posso copiar uma refeição de outro dia ("repetir ontem").
- **US-13** Edito a quantidade ou removo um item (swipe ou toque).

### 4.5 Adicionar alimento
Tela única com abas **Buscar · Recentes · Favoritos · Receitas · Meus alimentos** e botão de **código de barras** sempre visível.

- **US-14 Busca por nome:** primeiro a base local (TACO + meus alimentos + já usados), depois Open Food Facts. Ignora acentos e tolera erros simples.
- **US-15 Código de barras:** abre a câmera e lê EAN-13/EAN-8/UPC; se encontrado, abre a tela de quantidade já preenchida.
  - Não encontrado → cadastro manual com o código já preenchido; o produto fica salvo.
  - Sem permissão de câmera → explicação + campo para digitar o código.
- **US-16 Quantidade:** escolho a unidade (g, ml ou porções, ex.: "1 fatia (25 g)") e vejo os nutrientes recalculados ao vivo.
- **US-17 Cadastro manual:** nome, marca, porção de referência, kcal, carboidratos, proteínas, gorduras e sódio (obrigatórios); porções extras opcionais.
- **US-18** Favoritar alimentos.

**Regra crítica — snapshot:** cada registro salva uma **cópia dos valores nutricionais** no momento do registro. Editar ou excluir o alimento/receita depois **não altera o histórico**.

### 4.6 Receitas
- **US-19** Crio uma receita com nome, ingredientes (alimento + quantidade) e número de porções (ex.: "Café padrão": pão 50 g, ovo 2 un, leite 200 ml, café 100 ml).
- **US-20** O app mostra o total e o valor por porção.
- **US-21** Ao adicionar a receita a uma refeição, escolho quantas porções (0,5 / 1 / 1,5 / …) e os nutrientes entram no dia automaticamente.
- **US-22** Edito, duplico e excluo receitas.

### 4.7 Treino (ficha básica)
- **US-23 Biblioteca de exercícios:** lista padrão em pt-BR com imagem, filtrável por grupo muscular (peito, costas, ombros, bíceps, tríceps, pernas, glúteos, abdômen, panturrilha) e com busca por nome.
- **US-24 Exercício personalizado:** crio um exercício que não está na biblioteca (nome, grupo muscular, imagem opcional).
- **US-25 Fichas:** crio treinos nomeados (padrão "Treino A", "Treino B"… com nome editável, ex.: "Treino A – Peito e Tríceps").
- **US-26 Montar o treino:** adiciono exercícios da biblioteca e defino **séries × repetições** (ex.: 4×10, 3×12, 3×15) e uma observação opcional (ex.: "drop-set na última").
- **US-27** Reordeno (arrastar), edito e removo exercícios do treino; duplico e excluo treinos.
- **US-28** Abro um treino e vejo a lista de exercícios com imagem e séries para consultar durante a academia.

- **US-28b Check-in do treino** (estilo "GymRats"): escolho um treino da minha ficha (ex.: Treino B) e tiro/envio uma **foto do dia**. O check-in fica registrado com data, hora, treino e foto.
- **US-28c** Vejo meus check-ins em um calendário/galeria, com sequência de dias (streak) e total de treinos no mês.
- **US-28d** Posso excluir um check-in (e a foto).

**Critérios de aceite**
- Séries: 1–10; repetições: 1–100 ou texto livre curto (ex.: "até a falha", "30 s").
- Sem registro de carga, cronômetro ou histórico de execução na v1.
- Check-in: foto obrigatória (câmera ou galeria), comprimida no aparelho (máx. ~1600 px, JPEG) antes do envio; fotos privadas, servidas só para a dona da conta.
- Check-ins são **privados** na v1 (decidido em 2026-11-24).

### 4.8 Peso corporal
- **US-29** Registro meu peso (data + kg, uma casa decimal); um registro por dia (novo registro no mesmo dia substitui).
- **US-30** Vejo gráfico de evolução com filtros 30 dias / 90 dias / 1 ano / tudo, peso atual, inicial e variação.
- **US-31** Edito ou excluo registros na lista de histórico.
- Card resumido na Home com o último peso e atalho para registrar.

### 4.9 Configurações
Perfil (nome, e-mail, senha), metas, refeições, sair, excluir conta, termos e privacidade.

---

## 5. Requisitos não funcionais

- **PWA:** instalável (manifest + ícones), banner "Instalar app", tela abre rápido mesmo com internet fraca (cache do app). Registros exigem conexão na v1; sem internet, mostrar aviso claro.
- **Desempenho:** primeira carga < 2,5 s em 4G; interações < 100 ms; Lighthouse ≥ 90.
- **Transições suaves:** 200–300 ms entre telas (slide), painéis que sobem de baixo para adicionar itens, anéis e barras animados. Respeitar `prefers-reduced-motion`.
- **Acessibilidade:** contraste WCAG AA, alvos de toque ≥ 44 px, labels em todos os campos.
- **Compatibilidade:** Chrome Android, Safari iOS 16.4+; desktop como secundário.
- **Segurança e LGPD:** HTTPS, senhas com hash (bcrypt/argon2), proteção contra força bruta no login, dados de saúde tratados como sensíveis, exclusão de conta.

---

## 6. Identidade visual

### Paleta base (fornecida)
| Token | Hex | Uso sugerido |
|-------|-----|--------------|
| `orchid` | `#CC6CD7` | Cor primária / calorias |
| `lavender` | `#A86BD6` | Carboidratos |
| `pink` | `#D66BAA` | Proteínas |
| `violet` | `#856BD6` | Gorduras / treino |
| `coral` | `#D66C6B` | Sódio / alertas |

### Complementos (contraste)
- Primária escura para botões com texto branco: `#9B3FA8`.
- Neutros: fundo `#FBF7FC`, superfície `#FFFFFF`, texto `#1F1724`, texto secundário `#6B6072`, bordas `#ECE3EF`.
- Água: `#6B8BD6`.
- Gradiente de destaque: `#CC6CD7 → #856BD6`.

### Logo e nome
- **Pendente:** arquivo em `assets/logo.(svg|png)` + confirmação de direito de uso; ícone quadrado 512×512 para o PWA.
- **Pendente:** nome do app (provisório: "Dieta & Treino").

---

## 7. Arquitetura técnica (proposta)

```
/var/www/html/dietaetreino
├── frontend/   React + Vite + TypeScript (PWA)
│               Tailwind CSS · Framer Motion · vite-plugin-pwa
│               @zxing/browser (código de barras) · dnd-kit (arrastar)
├── backend/    PHP 8.3 + Laravel (API REST, Sanctum para auth)
│               MySQL 8 / MariaDB
└── SPEC.md
```

- **Código de barras:** backend consulta a Open Food Facts e guarda o produto no banco (cache).
- **TACO:** importada via seed (~600 alimentos).
- **Biblioteca de exercícios:** base de domínio público *free-exercise-db* (imagens incluídas), com seleção de ~150 exercícios mais comuns e nomes traduzidos para pt-BR.

### Modelo de dados (resumo)
- `users` (id, nome, email, senha, criado_em)
- `goals` (user_id, vigente_desde, kcal, carb_g, prot_g, gord_g, sodio_mg, agua_ml)
- `foods` (id, user_id|null, origem[taco|off|manual], ean, nome, marca, base_g, kcal, carb, prot, gord, sodio)
- `food_portions` (food_id, rotulo, gramas)
- `favorites` (user_id, food_id)
- `recipes` (id, user_id, nome, porcoes) · `recipe_items` (recipe_id, food_id, quantidade, unidade)
- `meals` (id, user_id, nome, ordem, ativo)
- `diary_entries` (id, user_id, data, meal_id, food_id|recipe_id, quantidade, unidade, **snapshot kcal/carb/prot/gord/sodio**)
- `water_logs` (id, user_id, data_hora, ml)
- `weights` (id, user_id, data, kg)
- `exercises` (id, user_id|null, nome, grupo_muscular, imagem)
- `workouts` (id, user_id, nome, ordem)
- `workout_items` (workout_id, exercise_id, ordem, series, repeticoes, observacao)

---

## 8. Roadmap

| Fase | Entregas |
|------|----------|
| **M1 – Fundação** | Setup, cadastro/login, metas manuais, paleta, shell PWA com navegação animada |
| **M2 – Diário alimentar** | Painel do dia, refeições, busca TACO, cadastro manual, água, snapshot |
| **M3 – Código de barras e receitas** | Scanner, Open Food Facts, receitas, favoritos/recentes, repetir refeição |
| **M4 – Treino** | Biblioteca com imagens, exercícios personalizados, fichas A/B/C/D, séries × reps |
| **M5 – Peso, polimento e publicação** | Peso corporal e gráfico, termos/privacidade, exclusão de conta, testes, Lighthouse, deploy no cPanel |

**v2 (futuro):** aba **Grupos** estilo GymRats (grupos com amigas, feed de check-ins, desafios e classificação), recuperação de senha, login com Google, notificações, modo escuro, cálculo automático de metas, registro de carga e cronômetro, offline completo.

---

## 9. Decisões complementares e pendências

**Decidido**
- Hospedagem: **compartilhada com cPanel** (HTTPS). Deploy: build do frontend + Laravel com `vendor/` gerado localmente e enviado; document root apontando para `backend/public`. Requer PHP ≥ 8.2 e MySQL no cPanel.
- Banco local: MySQL 8.4 via Docker (`docker-compose.yml`, porta 3307). Requer ativar a integração WSL no Docker Desktop.
- Login: somente e-mail e senha; sem recuperação de senha na v1.
- Peso corporal com gráfico: **entra na v1** (seção 4.8).

**Pendente**
1. **Logo:** a imagem enviada é uma fan art de um personagem registrado de terceiros (e tem assinatura de artista). Para um app público, isso é risco de notificação/remoção. Decidir: usar mesmo assim, encomendar/licenciar uma arte original, ou usar um mascote original temporário.
2. **Nome do app** (provisório: "Dieta & Treino").
3. Confirmar no cPanel a versão do PHP disponível (≥ 8.2).
