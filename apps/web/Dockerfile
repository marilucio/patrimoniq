FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web
COPY packages/domain ./packages/domain

RUN pnpm --filter @patrimoniq/domain build
RUN pnpm --filter @patrimoniq/web build

EXPOSE 3000

CMD ["pnpm", "--filter", "@patrimoniq/web", "start"]
