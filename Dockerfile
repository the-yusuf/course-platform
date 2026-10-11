# syntax=docker/dockerfile:1

# ---- build: every dependency, compiles TypeScript to dist/ -------------------
# Also the image of the `migrate` service in compose.yaml: migrations and seeds
# run through kysely-ctl, a dev dependency that reads the .ts files directly.
FROM node:24-slim AS build
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- prod-deps: only what the API needs at runtime ---------------------------
FROM node:24-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: the image that runs the API ------------------------------------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Owned by `node`, so the uploads volume starts out writable by the API
RUN mkdir uploads && chown node:node uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
