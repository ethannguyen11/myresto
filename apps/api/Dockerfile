# Build context: monorepo root (dockerContext: .)

# ── Stage 1 — Builder ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json  ./apps/api/
COPY apps/web/package.json  ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/

ENV NODE_OPTIONS="--max-old-space-size=400"

RUN npm install --workspace=apps/api --legacy-peer-deps

COPY apps/api/prisma           ./apps/api/prisma
COPY apps/api/src              ./apps/api/src
COPY apps/api/tsconfig*.json   ./apps/api/
COPY apps/api/nest-cli.json    ./apps/api/
COPY apps/api/prisma.config.ts ./apps/api/

ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost/placeholder
ENV DATABASE_URL=$DATABASE_URL

WORKDIR /app/apps/api

RUN npm install dotenv --no-save
RUN npx prisma generate
RUN npm run build

# ── Stage 2 — Production ───────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json    ./apps/api/
COPY apps/web/package.json    ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/

ENV NODE_OPTIONS="--max-old-space-size=400"

RUN npm install --workspace=apps/api --legacy-peer-deps --omit=dev

COPY --from=builder /app/apps/api/dist  ./apps/api/dist
COPY --from=builder /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma  ./node_modules/@prisma
COPY apps/api/prisma ./apps/api/prisma
# `prisma migrate deploy` lit l'URL de la base dans prisma.config.ts : sans ce
# fichier, la CLI refuse de démarrer (« datasource.url property is required »).
# Il est placé à côté de prisma/ pour que « prisma/schema.prisma » se résolve.
COPY apps/api/prisma.config.ts ./apps/api/

WORKDIR /app/apps/api

EXPOSE 3000

# Les migrations sont appliquées au démarrage, avant que le serveur n'écoute.
# Sans cela, toute nouvelle migration devait être jouée à la main sur la prod,
# et un déploiement pouvait tourner contre un schéma périmé sans rien signaler.
# `migrate deploy` n'applique que les migrations déjà commitées et ne génère
# jamais de migration : c'est la commande prévue pour la production.
# --no-install : utilise la CLI prisma installée (même version que @prisma/client,
# déclarée dans les dependencies) et échoue plutôt que d'en télécharger une autre.
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node dist/src/main"]
