# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**myresto** is an open-source restaurant management application with three apps:

- `apps/api` — NestJS REST API (primary, most developed)
- `apps/web` — React 19 + Vite frontend (scaffolded)
- `apps/mobile` — Expo/React Native app (scaffolded)

## Commands

All commands must be run from each app's directory.

### API (`cd apps/api`)
```bash
npm run start:dev        # dev server with hot reload
npm run build            # compile to dist/
npm run start:prod       # run compiled build
npm run test             # unit tests (jest, *.spec.ts)
npm run test:e2e         # e2e tests (test/jest-e2e.json)
npm run test:cov         # coverage
npm run lint             # eslint --fix
npm run format           # prettier
```

### Prisma (`cd apps/api`)
```bash
npx prisma migrate dev   # apply migrations + regenerate client
npx prisma generate      # regenerate client only
npx prisma studio        # GUI to browse DB
```

### Web (`cd apps/web`)
```bash
npm run dev              # Vite dev server
npm run build            # production build
npm run lint             # eslint
```

## Architecture

### API Module Structure

Each feature follows the NestJS pattern: `module → controller → service → prisma`. All modules live in `apps/api/src/`:

- `auth/` — JWT login via `POST /auth/login`. Uses `passport-jwt` + `bcrypt`. JWT guard (`jwt-auth.guard.ts`) is applied per-route.
- `users/` — User lookup; no public controller yet.
- `ingredients/` — Full CRUD. Price changes are automatically written to `PriceHistory` on create and update.
- `recipes/` — Full CRUD with food cost calculation. Recipe items (ingredients + quantities) are replaced wholesale on update.

### Data Model (Prisma)

All resources are **user-scoped** — every query filters by `userId` from the JWT payload. The schema (`apps/api/prisma/schema.prisma`) has:

- `User` → owns all other entities
- `Ingredient` + `PriceHistory` — tracks price changes over time; source is `"manual"` or `"invoice"`
- `Recipe` + `RecipeItem` — links ingredients with quantities; `sellingPrice` and `vatRate` stored on recipe
- `Invoice` + `InvoiceItem` — designed for AI-powered invoice parsing (status flow: `pending → analyzing → reviewed → validated | error`)

The Prisma client is generated into `apps/api/src/generated/prisma/`. The `PrismaService` (`src/prisma/prisma.service.ts`) is provided globally via `PrismaModule`.

### Food Cost Logic

`RecipesService.calculateFoodCost()` computes food cost % as `(totalIngredientCost / sellingPrice) * 100`. Thresholds: ≤25% excellent, ≤30% correct, ≤35% attention, >35% non-rentable. The `GET /recipes/menu-analysis` endpoint returns a global profitability summary with alerts for non-rentable dishes.

### Auth Flow

JWT payload: `{ sub: userId, email }`. The `JwtStrategy` validates the token and attaches the user to the request. Protected routes use `@UseGuards(JwtAuthGuard)` and extract `userId` from `req.user.id`.

### Environment

`apps/api/.env` — requires:
- `DATABASE_URL` — PostgreSQL connection string (default: `postgresql://postgres:14@127.0.0.1:5432/myresto`)
- `JWT_SECRET` — secret for JWT signing
- `ANTHROPIC_API_KEY` — clé API Claude pour l'analyse des factures

### Uploaded files

Factures uploadées stockées dans `apps/api/uploads/invoices/` (créé automatiquement au démarrage). Formats acceptés : PDF, JPEG, PNG, WEBP. Limite : 10 Mo.

## Mode de travail
- Travaille de manière fluide et enchaîne les étapes sans attendre de validation intermédiaire
- Exécute les commandes shell nécessaires directement
- Teste toujours que le build compile après chaque modification
- Ne t'arrête que si tu rencontres une erreur vraiment bloquante
