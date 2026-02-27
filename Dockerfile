# ── Estágio 1: instalar dependências e compilar addons nativos ───
FROM node:20-alpine AS deps

# Ferramentas para compilar better-sqlite3 (addon nativo C++)
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Estágio 2: build Next.js ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── Estágio 3: imagem final (standalone) ─────────────────────────
FROM node:20-alpine AS runner

# Ferramentas mínimas para better-sqlite3 funcionar em runtime
RUN apk add --no-cache libstdc++

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copiar output standalone do Next.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copiar módulo nativo compilado (better-sqlite3)
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

EXPOSE 3000

# Volume para o banco SQLite
VOLUME ["/data"]

CMD ["node", "server.js"]
