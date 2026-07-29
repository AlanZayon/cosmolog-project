#!/usr/bin/env bash
# Mirrors .github/workflows/api-test.yml locally.
# On low-RAM WSL2 hosts (~8GB), default to fewer compile/test jobs to avoid OOM.
set -euo pipefail

cd "$(dirname "$0")/.."

export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://cosmolog:cosmolog@127.0.0.1:5433/cosmolog_test}"
export RUST_BACKTRACE="${RUST_BACKTRACE:-1}"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}"
export RUST_TEST_THREADS="${RUST_TEST_THREADS:-2}"

echo "==> cargo test (TEST_DATABASE_URL=$TEST_DATABASE_URL CARGO_BUILD_JOBS=$CARGO_BUILD_JOBS RUST_TEST_THREADS=$RUST_TEST_THREADS)"
cargo test

if command -v cargo-llvm-cov >/dev/null 2>&1; then
  echo "==> cargo llvm-cov"
  cargo llvm-cov \
    --lcov --output-path lcov.info \
    --summary-only \
    --ignore-filename-regex 'main\.rs' \
    --fail-under-lines 45
  echo "Coverage report: lcov.info (upload to Codecov or open HTML via: cargo llvm-cov report --html)"
else
  echo "Skip coverage: install cargo-llvm-cov (cargo install cargo-llvm-cov)"
  echo "  and rust component: rustup component add llvm-tools-preview"
fi
