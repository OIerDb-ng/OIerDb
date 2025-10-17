FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable Corepack for Yarn
RUN corepack enable

# Install turbo globally
RUN yarn global add turbo@^2

COPY . .
RUN turbo prune @oierdb/backend --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable Corepack for Yarn
RUN corepack enable

# First install the dependencies (as they change less often)
COPY --from=deps /app/out/json/ .
RUN yarn install --frozen-lockfile

# Build the project
COPY --from=deps /app/out/full/ .

RUN yarn build:backend

# Install only production dependencies in a clean directory
FROM base AS production-deps
WORKDIR /app

RUN corepack enable

COPY --from=deps /app/out/json/ .
RUN yarn workspaces focus @oierdb/backend --production

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs &&\
    adduser --system --uid 1001 nestjs
USER nestjs

# Copy built application
COPY --from=installer --chown=nestjs:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=installer --chown=nestjs:nodejs /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=installer --chown=nestjs:nodejs /app/packages ./packages
COPY --from=production-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=production-deps --chown=nestjs:nodejs /app/package.json ./package.json

# Expose the application port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/backend/dist/main.js"]
