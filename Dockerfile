# # ---------- Build Stage ----------
FROM node:22.20.0-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production   # <-- only install production deps (saves space)

COPY . .
RUN npm run build

# ---------- Runtime Stage ----------
FROM node:22.20.0-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# Copy all env files so API routes can read server-side env vars at runtime
COPY --from=builder /app/.env* ./

# Next.js will run on port 8080 (Cloud Run expects this)
EXPOSE 8080

# Use "next start" directly to avoid potential npm wrapper overhead
CMD ["node_modules/.bin/next", "start", "-p", "8080"]