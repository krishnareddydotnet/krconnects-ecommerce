# -----------------------------------------------------------------------
# KRConnects Notification Service - multi-stage Dockerfile
#
# Tech stack : Node.js 22, Express 5 (health only), Azure Service Bus SDK
# Port       : 8083
# Runs as    : node (UID 1000)
# Stages     : 1) build   (node:22-alpine) -> npm ci --omit=dev (production packages only)
#              2) runtime (node:22-alpine) -> runs node src/server.js (worker + health server)
#
# Local commands (run from the notification-service folder):
#   Build image : docker build -t notification-service:v1.0.0 .
#   Run         : docker run --rm -p 8083:8083 notification-service:v1.0.0
#   Test        : curl http://localhost:8083/health/live
#   Unit tests  : npm ci && npm test
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
