FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS production
WORKDIR /app

COPY --from=build /app/.next .next
COPY --from=build /app/public public
COPY --from=build /app/package.json .
COPY --from=build /app/node_modules node_modules

ENV NODE_ENV=production
EXPOSE 3000
USER node

CMD ["node_modules/.bin/next", "start"]
