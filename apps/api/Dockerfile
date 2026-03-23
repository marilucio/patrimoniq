FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/domain ./packages/domain

RUN pnpm --filter @patrimoniq/domain build
RUN pnpm --filter @patrimoniq/api prisma generate
RUN pnpm --filter @patrimoniq/api build

EXPOSE 3333

CMD ["node", "apps/api/dist/apps/api/src/main.js"]
