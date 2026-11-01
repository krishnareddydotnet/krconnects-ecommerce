# -----------------------------------------------------------------------
# KRConnects Customer Portal - multi-stage Dockerfile
#
# Tech stack : React 19, Vite 8 (build), nginx (serve)
# Port       : 8080
# Runs as    : nginx (UID 101)
# Stages     : 1) build   (node:22-alpine) -> npm install, npm run build (static files in dist/)
#              2) runtime (nginxinc/nginx-unprivileged:alpine) -> serves dist/ and forwards API calls (nginx.conf)
#
# Local commands (run from the customer-portal folder):
#   Build image : docker build -t customer-portal:v1.0.0 .
#   Run         : docker run --rm -p 8080:8080 --add-host auth-api:127.0.0.1 --add-host catalog-api:127.0.0.1 --add-host order-api:127.0.0.1 customer-portal:v1.0.0
#                 (nginx.conf names auth-api, catalog-api, order-api; nginx won't start unless they resolve)
#   Test        : curl http://localhost:8080/health/live
#   Unit tests  : npm ci && npm test
# -----------------------------------------------------------------------

# Stage 1: Build (Node.js needed only at build time to bundle static files)
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve with the non-root nginx image (runs as user 101)
FROM nginxinc/nginx-unprivileged:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Run as non-root user (101 = nginx user in this image)
USER 101

# Non-root users can't use ports below 1024, so we use 8080
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]