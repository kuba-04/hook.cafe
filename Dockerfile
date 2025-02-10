FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm install --production
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/build ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/static ./static
EXPOSE 3000
ENV UV_THREADPOOL_SIZE=32
ENV PUBLIC_RELAY_URL=ws://127.0.0.1:8080
CMD ["node", "index.js"]