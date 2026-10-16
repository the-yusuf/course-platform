# syntax=docker/dockerfile:1

# Debian 13: its packages are new enough to compile libvips 8.18
ARG NODE_IMAGE=node:24-trixie-slim

# ---- build: every dependency, compiles TypeScript to dist/ -------------------
# Also the image of the `migrate` service in compose.yaml: migrations and seeds
# run through kysely-ctl, a dev dependency that reads the .ts files directly.
FROM ${NODE_IMAGE} AS build
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- libvips: the image library behind sharp, compiled for any x86-64 CPU ----
# sharp's prebuilt binaries need x86-64-v2 (SSE4.2, POPCNT), which some VPSs
# hide, e.g. "QEMU Virtual CPU version 2.5+". Docker caches this stage, so it
# is compiled again only when VIPS_VERSION or the base image changes.
FROM ${NODE_IMAGE} AS libvips
# must be at least the version sharp's package.json asks for (config.libvips)
ARG VIPS_VERSION=8.18.7
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential ca-certificates curl meson ninja-build pkg-config python3 xz-utils \
      libexif-dev libexpat1-dev libglib2.0-dev libhwy-dev libjpeg62-turbo-dev \
      liblcms2-dev libpng-dev libwebp-dev \
  && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL "https://github.com/libvips/libvips/releases/download/v${VIPS_VERSION}/vips-${VIPS_VERSION}.tar.xz" \
      | tar -xJ -C /tmp \
  && cd "/tmp/vips-${VIPS_VERSION}" \
  && meson setup build --prefix=/usr/local --libdir=lib --buildtype=release \
      -Dmodules=disabled -Dintrospection=disabled -Ddeprecated=false -Dexamples=false \
  && meson compile -C build \
  && meson install -C build \
  && ldconfig \
  && rm -rf "/tmp/vips-${VIPS_VERSION}"

# ---- prod-deps: only what the API needs at runtime ---------------------------
# sharp is compiled here against the libvips above, replacing its prebuilt binary
FROM libvips AS prod-deps
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm install --global node-gyp@12 node-addon-api@8 \
  && cd node_modules/sharp \
  && NODE_PATH="$(npm root --global)" npm_config_nodedir=/usr/local npm run build \
  && rm -rf /app/node_modules/@img/sharp-*

# ---- runtime: the image that runs the API ------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
# the shared libraries libvips was compiled against
RUN apt-get update && apt-get install -y --no-install-recommends \
      libexif12 libexpat1 libglib2.0-0t64 libhwy1t64 libjpeg62-turbo liblcms2-2 \
      libpng16-16t64 libwebp7 libwebpdemux2 libwebpmux3 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=libvips /usr/local/lib/libvips*.so* /usr/local/lib/
RUN ldconfig
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
