# Docker Setup for bLoom

This document explains how to run bLoom using Docker and Docker Compose.

## Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (version 2.0 or later)

## Quick Start

### Development Environment
```bash
# Run in development mode with hot reloading
docker-compose -f docker-compose.dev.yml up --build
```

### Production Environment
```bash
# Run in production mode
docker-compose -f docker-compose.prod.yml up --build -d
```

### Staging Environment
```bash
# Run in staging mode
docker-compose -f docker-compose.staging.yml up --build -d
```

## Environment Configuration

The application uses environment-specific configurations. Make sure to set the appropriate environment variables in your `.env` files:

### Root `.env`
```env
NODE_ENV=dev  # or staging, production
DEV_FRONTEND_URL=http://localhost:3000
DEV_BACKEND_URL=http://localhost:3001
STAGING_FRONTEND_URL=http://REDACTED_IP:3000
STAGING_BACKEND_URL=http://REDACTED_IP:3001
PROD_FRONTEND_URL=
PROD_BACKEND_URL=
```

### Frontend `.env`
```env
REACT_APP_NODE_ENV=dev  # or staging, production
REACT_APP_DEV_BACKEND_URL=http://localhost:3001
REACT_APP_STAGING_BACKEND_URL=http://REDACTED_IP:3001
REACT_APP_PROD_BACKEND_URL=
```

## Available Services

- **Frontend**: React application running on port 3000
- **Backend**: Node.js/Express API server running on port 3001

## Docker Compose Files

- `docker-compose.yml` - Base configuration
- `docker-compose.dev.yml` - Development with hot reloading
- `docker-compose.staging.yml` - Staging environment
- `docker-compose.prod.yml` - Production with resource limits

## Common Commands

### Build and Start Services
```bash
# Development
docker-compose -f docker-compose.dev.yml up --build

# Staging
docker-compose -f docker-compose.staging.yml up --build -d

# Production
docker-compose -f docker-compose.prod.yml up --build -d
```

### Stop Services
```bash
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.prod.yml down
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend
```

### Rebuild Specific Service
```bash
docker-compose -f docker-compose.dev.yml up --build backend
```

## Development Mode Features

- **Hot Reloading**: Code changes are automatically reflected
- **Volume Mounting**: Source code is mounted for live editing
- **Development Dependencies**: Includes nodemon for backend auto-restart

## Production Mode Features

- **Multi-stage Builds**: Optimized Docker images
- **Resource Limits**: CPU and memory constraints
- **Health Checks**: Automatic service health monitoring
- **Security**: Non-root user execution

## Troubleshooting

### Port Conflicts
If ports 3000 or 3001 are already in use:
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :3001

# Kill the processes or change ports in docker-compose files
```

### Permission Issues
```bash
# Fix ownership issues (Linux/Mac)
sudo chown -R $USER:$USER .
```

### Clean Up
```bash
# Remove all containers and volumes
docker-compose -f docker-compose.dev.yml down -v
docker system prune -a
```

### Health Check Failures
Check service logs:
```bash
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend
```

## Environment Switching

To switch between environments, update the environment variables in your `.env` files and restart the containers:

```bash
# Stop current environment
docker-compose -f docker-compose.dev.yml down

# Update .env files with new NODE_ENV values

# Start new environment
docker-compose -f docker-compose.staging.yml up --build -d
```