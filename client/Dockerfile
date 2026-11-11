# ==========================================
# Stage 1: Build the React / Vite application
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests first for caching layers
COPY package.json package-lock.json ./

# Install all dependencies required for production build
RUN npm ci

# Copy application source code
COPY . .

# Build production distribution assets
RUN npm run build

# ==========================================
# Stage 2: Production Nginx Server
# ==========================================
FROM nginx:1.27-alpine AS production

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom Nginx reverse proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled frontend assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]

