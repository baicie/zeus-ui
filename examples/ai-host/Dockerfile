FROM node:24.18.0-bookworm-slim
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
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json rolldown.config.ts ./
COPY packages ./packages
COPY scripts ./scripts
COPY examples/ai-host ./examples/ai-host
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN useradd --system --uid 10001 --create-home zeus
RUN mkdir -p /data && chown -R zeus:zeus /data /app
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
