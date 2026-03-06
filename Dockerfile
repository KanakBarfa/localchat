FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN bun install --production
COPY . .
RUN bun build ./server.js --compile --minify --outfile=chat-server

FROM alpine:latest AS runner
WORKDIR /app

# Install the missing C++ and GCC libraries
RUN apk add --no-cache libstdc++ libgcc

ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/chat-server .
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["./chat-server"]