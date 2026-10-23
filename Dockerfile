# ---------- 1) Build the SQLite database from the official Torob dataset ----------
FROM node:24-alpine AS data
WORKDIR /app
ARG DATASET_URL=https://startech.s3.ir-central1.arvanstorage.ir/starcoach-dataset-v16-cap300-csv.zip
RUN apk add --no-cache curl unzip
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/text.ts server/text.ts
COPY scripts/build-db.ts scripts/build-db.ts
RUN curl -fsSL "$DATASET_URL" -o /tmp/ds.zip \
 && mkdir -p /tmp/ds && unzip -q /tmp/ds.zip -d /tmp/ds -x "__MACOSX/*" \
 && DIR=$(dirname "$(find /tmp/ds -name shops.csv | head -1)") \
 && node scripts/build-db.ts "$DIR" data/torob.db \
 && rm -rf /tmp/ds /tmp/ds.zip

# ---------- 2) Build the web app ----------
FROM node:24-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------- 3) Runtime ----------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DB_PATH=/app/data/torob.db
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server ./server
COPY --from=data /app/data/torob.db ./data/torob.db
COPY --from=web /app/web/dist ./web/dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server/index.ts"]
