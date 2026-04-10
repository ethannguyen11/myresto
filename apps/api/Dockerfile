# Build context: monorepo root (dockerContext: .)

FROM node:20-alpine

# bcrypt uses a native C++ addon — build tools required on Alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app

# ── Workspace manifests ────────────────────────────────────────────────────
# npm needs ALL workspace package.json files to resolve the workspace graph
# (root package.json declares "workspaces": ["apps/*", "packages/*"])
COPY package*.json ./
COPY apps/api/package.json     ./apps/api/
COPY apps/web/package.json     ./apps/web/
COPY apps/mobile/package.json  ./apps/mobile/

# Install only apps/api dependencies (hoisted to /app/node_modules)
RUN npm install --workspace=apps/api

# ── API source files ───────────────────────────────────────────────────────
COPY apps/api/src              ./apps/api/src
COPY apps/api/prisma           ./apps/api/prisma
COPY apps/api/tsconfig*.json   ./apps/api/
COPY apps/api/nest-cli.json    ./apps/api/
COPY apps/api/prisma.config.ts ./apps/api/

# ── Build ──────────────────────────────────────────────────────────────────
WORKDIR /app/apps/api

# prisma.config.ts calls env("DATABASE_URL") when loaded by the CLI.
# prisma generate does NOT open a DB connection — placeholder is safe.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL

# "prisma generate && nest build" — compiles src/ → dist/
RUN npm run build

EXPOSE 3000

# nest-cli.json sourceRoot="src" → entry point is dist/main.js (not dist/src/main)
CMD ["node", "dist/main"]
