FROM mcr.microsoft.com/devcontainers/rust:1-bookworm

ARG NODE_VERSION=22

RUN su vscode -c "rustup component add rustfmt clippy llvm-tools-preview" \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && su vscode -c "cargo install cargo-watch --locked 2>/dev/null || true"

WORKDIR /workspace
