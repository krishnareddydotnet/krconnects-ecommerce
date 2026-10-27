# -----------------------------------------------------------------------
# KRConnects Customer Portal - multi-stage Dockerfile
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