# Dockerfile for reserve-api
# Production-ready, multi-stage build with version pinning

# Build stage
FROM node:20.19.3-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (with exact versions from package-lock.json)
RUN npm ci --only=production && \
    npm ci --only=development

RUN apk add --no-cache dumb-init curl

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20.19.3-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/main.js"]
