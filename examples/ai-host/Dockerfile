# The Host imports only Node builtins and its own siblings — no workspace
# package, no third-party dependency. A single-stage build therefore carried the
# whole monorepo (node_modules plus every package source) into the published
# image, most of which is only needed to compile. Build and runtime are split
# so the image ships what it runs.
FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json rolldown.config.ts ./
COPY packages ./packages
COPY scripts ./scripts
COPY examples/ai-host ./examples/ai-host
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:24.18.0-bookworm-slim AS runtime
ARG ZEUS_CORE_COMMIT
ARG ZEUS_UI_COMMIT
ARG ZEUS_VERSION
ARG ZEUS_BUILD_TIME
LABEL org.opencontainers.image.revision=$ZEUS_UI_COMMIT \
  org.opencontainers.image.version=$ZEUS_VERSION \
  top.moonbyte.zeus.core-commit=$ZEUS_CORE_COMMIT \
  top.moonbyte.zeus.ui-commit=$ZEUS_UI_COMMIT \
  top.moonbyte.zeus.build-time=$ZEUS_BUILD_TIME
WORKDIR /app
ENV NODE_ENV=production
# `tsx` runs the TypeScript sources directly; it is the only runtime dependency.
RUN npm install --no-save --omit=dev tsx@4.22.4 \
  && npm cache clean --force \
  && rm -rf /root/.npm
COPY --from=build /app/examples/ai-host ./examples/ai-host
RUN useradd --system --uid 10001 --create-home zeus \
  && mkdir -p /data \
  && chown -R zeus:zeus /data /app
USER zeus
ENV ZEUS_AI_DB=/data/ai.sqlite
ENV ZEUS_AI_HOST=0.0.0.0
ENV ZEUS_AI_WORKSPACE=/data/workspace
ENV ZEUS_AI_WORKSPACE_ID=reference
ENV PORT=8788
EXPOSE 8788
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "examples/ai-host/src/server.ts"]
