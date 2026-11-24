# Dieta & Treino

PWA de dieta e treino. Especificação completa em [SPEC.md](SPEC.md).

- `backend/` — Laravel (API REST + Sanctum)
- `frontend/` — React + Vite + TypeScript + Tailwind + Framer Motion (PWA)
- `docker-compose.yml` — MySQL 8.4 local (porta 3307)

## Rodar localmente

```bash
# 1. Banco (Docker Desktop com integração WSL ativa)
docker compose up -d

# 2. API — http://localhost:8000
cd backend
php artisan migrate
php artisan db:seed   # importa TACO (595 alimentos) e biblioteca de exercícios (179)
php artisan serve

# 3. App — http://localhost:5173 (proxy de /api para a porta 8000)
cd frontend
npm run dev
```

## Status

| Etapa | Situação |
|-------|----------|
| M1 – Fundação (cadastro, login, metas, navegação, PWA) | ✅ |
| M2 – Diário alimentar (TACO, busca, porções, água, refeições, cadastro manual) | ✅ |
| M3 – Código de barras (Open Food Facts), produtos de marca na busca, receitas | ✅ |
| M4 – Treino (fichas A/B/C, biblioteca com 179 exercícios, check-in com foto) | ✅ |
| M5 – Peso com gráfico, banner de instalação, aviso offline, pacote de publicação no cPanel | ✅ |

## Publicação
Passo a passo completo em [deploy/COMO-PUBLICAR.md](deploy/COMO-PUBLICAR.md):

```bash
bash deploy/build.sh && bash deploy/deploy.sh   # use --seed no primeiro deploy
```

## Pendências
- Logo definitiva (hoje: logo provisória original em `frontend/public/logo.svg`).
- Texto de Termos/Privacidade deve ser revisado antes de publicar.

## Fontes de dados
- Alimentos: Tabela TACO 4ª ed. (NEPA/UNICAMP) via github.com/raulfdm/taco-api (MIT); leites integral/desnatado UHT completados com USDA FoodData Central (domínio público).
- Produtos de marca e código de barras: Open Food Facts (ODbL) — exibir atribuição no app.
- Exercícios e imagens: free-exercise-db (Unlicense / domínio público), nomes traduzidos.

## Fotos de check-in
Ficam em `backend/storage/app/private/checkins/{usuário}/` (fora da pasta pública), sem metadados (EXIF/GPS),
e só são servidas por link assinado temporário. Inclua essa pasta no backup do servidor.
