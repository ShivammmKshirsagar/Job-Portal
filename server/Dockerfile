# ==========================================
# Production Node.js Backend Container
# ==========================================
FROM node:22-alpine AS production

# Install curl for container health check
RUN apk add --no-cache curl

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure uploads directory exists with correct write permissions for node user
RUN mkdir -p uploads && chown -R node:node /app

# Switch to non-privileged user for security
USER node

# Expose backend port
EXPOSE 5000

# Set environment variables defaults
ENV NODE_ENV=production \
    PORT=5000 \
    UPLOAD_PATH=uploads

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start the server
CMD ["node", "src/server.js"]

