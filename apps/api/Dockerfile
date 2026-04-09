# ── Build stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

# prisma.config.ts calls env("DATABASE_URL") when loaded by the CLI.
# Provide a placeholder so `prisma generate` can run during build without
# needing a real database connection (generate only reads the schema file).
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL

COPY . .
# Runs: prisma generate  →  generates @prisma/client typings
#       nest build        →  tsc compiles src/ → dist/
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Compiled application
COPY --from=builder /app/dist        ./dist
# All runtime dependencies (including @prisma/client)
COPY --from=builder /app/node_modules ./node_modules
# Prisma schema — kept for reference and potential migration tooling
COPY --from=builder /app/prisma       ./prisma
# package.json for metadata / npm scripts access
COPY package*.json ./

EXPOSE 3000
CMD ["node", "dist/main"]
