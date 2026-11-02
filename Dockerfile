# syntax=docker/dockerfile:1

FROM docker.io/oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/opencode-plugin/package.json packages/opencode-plugin/package.json
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run --cwd apps/web build

FROM docker.io/oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000 \
    OPENCODE_MODE=auto \
    PLATFORM_API_URL=http://127.0.0.1:3000 \
    PATH=/root/.bun/bin:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && bun add -g --trust @opencode/cli@2.2.5

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/bun.lock /app/tsconfig.base.json ./
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

VOLUME ["/data"]
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
