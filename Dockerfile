# Multi-stage build for GBIF MCP Server
# Stage 1: Build
FROM node:20-alpine AS builder

LABEL maintainer="Tyson Swetnam <tswetnam@arizona.edu>"
LABEL description="GBIF MCP Server - Model Context Protocol server for GBIF biodiversity data"
LABEL version="1.1.0"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install --only=development && \
    npm run build && \
    npm prune --production

# Stage 2: Runtime
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S gbif && \
    adduser -u 1001 -S gbif -G gbif

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=gbif:gbif /app/node_modules ./node_modules
COPY --from=builder --chown=gbif:gbif /app/build ./build
COPY --from=builder --chown=gbif:gbif /app/package*.json ./

# Switch to non-root user
USER gbif

# Set environment variables
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    LOG_FORMAT=json

# Health check (for when running as HTTP server in future)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run the MCP server
CMD ["node", "build/index.js"]

# Metadata
LABEL org.opencontainers.image.source="https://github.com/idss-mesa/gbif-mcp"
LABEL org.opencontainers.image.description="MCP server providing access to GBIF biodiversity data"
LABEL org.opencontainers.image.licenses="MIT"
