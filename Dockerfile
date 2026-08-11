# ── Stage 1: Build the Vite frontend ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first — Docker caches this layer if deps haven't changed
COPY package*.json ./
RUN npm ci

# Copy everything and build
# --base / overrides the GitHub Pages base path (/KSP-at-home/) for production
COPY . .
RUN npm run build:docker


# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only install production dependencies — no Vite, no Tailwind, no dev tools
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend from Stage 1
COPY --from=builder /app/dist ./dist

# Copy Express server
COPY server ./server
CMD ["bash","./cron.sh"]
# Render injects PORT automatically at runtime.
# The server reads process.env.PORT, so no hardcoded port needed here.
CMD ["node", "server/index.js"]
