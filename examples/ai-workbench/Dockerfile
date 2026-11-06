# Static AI Workbench shell. The /ai-host/ path is proxied to the reference
# host service by nginx, so the browser only talks to one origin.
FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json rolldown.config.ts ./
COPY packages ./packages
COPY scripts ./scripts
COPY examples/ai-workbench ./examples/ai-workbench
ARG ZEUS_CORE_COMMIT
ARG ZEUS_UI_COMMIT
ARG ZEUS_VERSION
ARG ZEUS_BUILD_TIME
RUN pnpm install --frozen-lockfile
RUN pnpm build
ARG ZEUS_AI_HOST_ORIGIN=""
ENV ZEUS_AI_HOST_ORIGIN=$ZEUS_AI_HOST_ORIGIN
RUN pnpm --filter @zeus-web/example-ai-workbench build
RUN node scripts/checks/build-info.mjs \
  --product ai-workbench \
  --dist examples/ai-workbench/dist \
  --core-commit "$ZEUS_CORE_COMMIT" \
  --ui-commit "$ZEUS_UI_COMMIT" \
  --version "$ZEUS_VERSION" \
  --built-at "$ZEUS_BUILD_TIME"

FROM nginx:1.29-alpine AS runtime
ARG ZEUS_UI_COMMIT
ARG ZEUS_VERSION
LABEL org.opencontainers.image.revision=$ZEUS_UI_COMMIT \
  org.opencontainers.image.version=$ZEUS_VERSION
COPY examples/ai-workbench/deploy/nginx.conf /etc/nginx/templates/default.conf.template
ENV NGINX_ENVSUBST_FILTER=ZEUS_AI_UPSTREAM_TOKEN
COPY --from=build /app/examples/ai-workbench/dist /usr/share/nginx/html
EXPOSE 80
