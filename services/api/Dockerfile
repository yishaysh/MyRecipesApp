# Multi-stage Dockerfile for @myrecipes/api
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifests
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/api/package*.json ./services/api/

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY packages/shared ./packages/shared
COPY services/api ./services/api

# Build shared packages and api
RUN npm run build --workspaces --if-present

# Production runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/api/package*.json ./services/api/

RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/api/dist ./services/api/dist

EXPOSE 3001

CMD ["node", "services/api/dist/server.js"]
