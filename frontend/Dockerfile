# Frontend Dockerfile - Multi-stage build
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install serve to run the built app
RUN npm install -g serve

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S frontend -u 1001

# Set working directory
WORKDIR /app

# Change ownership of working directory
RUN chown frontend:nodejs /app
USER frontend

# Copy built application from builder stage
COPY --from=builder --chown=frontend:nodejs /app/build ./build
COPY --from=builder --chown=frontend:nodejs /app/package.json ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start the application
CMD ["serve", "-s", "build", "-l", "3000"]