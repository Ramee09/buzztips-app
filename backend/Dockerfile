# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --silent

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S buzztips && adduser -S buzztips -G buzztips
COPY --from=builder /app/node_modules ./node_modules
COPY . .
USER buzztips
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD wget -qO- http://localhost:5000/health || exit 1
CMD ["node", "server.js"]
