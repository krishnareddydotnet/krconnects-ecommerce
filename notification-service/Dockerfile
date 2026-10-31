# -----------------------------------------------------------------------
# KRConnects Notification Service - multi-stage Dockerfile
# -----------------------------------------------------------------------

# Stage 1: Install production dependencies only (no test tools like supertest)
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Run
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Files are owned by root and read-only for the app user, so the running
# app can't change its own code.
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/

# Run as the built-in non-root "node" user of the Node.js image
USER node

# Port 8083 is only for the health probes (this service has no public API).
# Non-root users can't use ports below 1024, so we use a high port.
EXPOSE 8083
ENV PORT=8083

CMD ["node", "src/server.js"]
