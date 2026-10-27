# ---------- 1. Use prebuilt SQLite database ----------
FROM node:24-alpine AS data

WORKDIR /app
COPY data/torob.db ./data/torob.db

# ---------- 2. Build frontend ----------
FROM node:24-alpine AS web

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY web/ ./
RUN npm run build

# ---------- 3. Production runtime ----------
FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV DB_PATH=/app/data/torob.db

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

COPY server/ ./server/
COPY --from=data /app/data/torob.db ./data/torob.db
COPY --from=web /app/web/dist ./web/dist

# Only the runtime files need to be owned by node
RUN chown -R node:node /app/server /app/web /app/data

USER node

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.ts"]
