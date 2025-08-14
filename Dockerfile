# Base with build tools
FROM node:24-slim AS build
RUN apt-get update && apt-get install -y python3 make g++ curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm \
  && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run baml-generate \
  && pnpm run build

# Production runtime
FROM node:24-slim AS runtime

# Install curl & dotenvx, then clean up
RUN apt-get update \
  && apt-get install -y curl \
  && curl -sfS https://dotenvx.sh/install.sh | sh \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only prod deps & built assets
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm \
  && pnpm install --prod --frozen-lockfile \
  && pnpm add concurrently \
  && pnpm add mastra@0.10.21

COPY --from=build /app/build ./build
COPY --from=build /app/public ./public
COPY --from=build /app/.mastra ./.mastra
# Create directory for Mastra database if needed
RUN mkdir -p /app/data
# COPY --from=build /app/.cache ./.cache
# COPY .env.production /app/.env.production
COPY --chown=node:node .env.production .

USER node
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NODE_OPTIONS=--max_old_space_size=1024 \
    MASTRA_DB_PATH=/app/data/mastra.db

EXPOSE 3000

# Run both app and Mastra concurrently by default
CMD ["dotenvx", "run", "-f", ".env.production", "--", "npx", "concurrently", "-n", "App,Mastra", "--c", "green,cyan", "pnpm start", "npx mastra serve --dir app/mastra"]
