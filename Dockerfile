FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/static ./static
EXPOSE 3000
ENV UV_THREADPOOL_SIZE=32
ENV PUBLIC_RELAY_URL=ws://127.0.0.1:8080
CMD ["node", "build"]