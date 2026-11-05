# Static AI Workbench shell. The /ai-host/ path is proxied to the reference
# host service by nginx, so the browser only talks to one origin.
FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json rolldown.config.ts ./
COPY packages ./packages
COPY scripts ./scripts
COPY examples/ai-workbench ./examples/ai-workbench
RUN pnpm install --frozen-lockfile
RUN pnpm build
ARG ZEUS_AI_HOST_ORIGIN=""
ENV ZEUS_AI_HOST_ORIGIN=$ZEUS_AI_HOST_ORIGIN
RUN pnpm --filter @zeus-web/example-ai-workbench build

FROM nginx:1.29-alpine AS runtime
COPY examples/ai-workbench/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/examples/ai-workbench/dist /usr/share/nginx/html
EXPOSE 80
