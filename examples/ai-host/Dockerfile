# The AI Host runtime image: Node plus one bundled ESM file.
#
# This used to be a single stage — `pnpm install` → `pnpm build` → `chown -R` —
# so the deployment carried the whole workspace dependency tree: 269.2 MB
# compressed / 676.2 MB uncompressed, of which `/app/node_modules` alone was
# 428 MB (rolldown bindings, three esbuild copies, typescript, playwright).
# None of it is imported at runtime: the server needs `node:*` builtins plus
# `@zeus-web/ai-core`, which is plain ESM.
#
# The builder installs the workspace and bundles; the runtime copies the one
# file. `pnpm build` still runs, so package builds and their type output are
# unchanged for every other consumer.
FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json rolldown.config.ts ./
COPY packages ./packages
COPY scripts ./scripts
COPY examples/ai-host ./examples/ai-host
RUN pnpm install --frozen-lockfile
RUN pnpm build
# Bundle after the workspace build: `@zeus-web/ai-core` is resolved through its
# built `dist`, the same code the previous image ran.
RUN mkdir -p /out \
  && node scripts/release/bundle-ai-host.mjs \
       --entry examples/ai-host/src/server.ts \
       --outfile /out/server.mjs

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
# Ownership at copy time; a later `chown -R /app` rewrote every file into a
# second layer and alone cost 98.9 MB of the old image.
RUN useradd --system --uid 10001 --create-home zeus \
  && mkdir -p /data \
  && chown zeus:zeus /data
COPY --chown=zeus:zeus --from=build /out/server.mjs ./server.mjs
USER zeus
ENV ZEUS_AI_DB=/data/ai.sqlite
ENV ZEUS_AI_HOST=0.0.0.0
ENV ZEUS_AI_WORKSPACE=/data/workspace
ENV ZEUS_AI_WORKSPACE_ID=reference
ENV PORT=8788
EXPOSE 8788
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8788/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
