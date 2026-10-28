# Self-host build for PIKR
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
COPY --from=build /app /app
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "preview", "--host", "0.0.0.0", "--port", "8080"]
