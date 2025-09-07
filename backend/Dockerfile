# Backend Dockerfile
FROM node:18-alpine

# Create non-root user first
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Set working directory
WORKDIR /app

# Change ownership of working directory
RUN chown backend:nodejs /app
USER backend

# Copy package files
COPY --chown=backend:nodejs package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY --chown=backend:nodejs . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Start the application
CMD ["node", "server.js"]