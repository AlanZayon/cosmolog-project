# syntax=docker/dockerfile:1
#
# Build from repo root:
#   docker build -f apps/api/Dockerfile -t cosmolog-api .
#
# Render: dockerContext = ., dockerfilePath = ./apps/api/Dockerfile

FROM rust:1-bookworm AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY apps/api ./apps/api
COPY apps/feed-relay ./apps/feed-relay
COPY apps/feed-features ./apps/feed-features
COPY apps/feed-rank ./apps/feed-rank

RUN cargo build --release --bin cosmolog_api

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/cosmolog_api /app/cosmolog_api
COPY --from=builder /app/apps/api/migrations /app/migrations

ENV API_HOST=0.0.0.0 \
    API_PORT=8080 \
    RUN_MIGRATIONS=false

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/health || exit 1

USER nobody

CMD ["/app/cosmolog_api"]
