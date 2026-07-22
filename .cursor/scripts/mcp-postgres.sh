#!/usr/bin/env bash
# Launch Postgres MCP using DATABASE_URL from apps/api/.env
# (Do not `source` the file — Neon URLs contain `&`, which breaks bash.)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/apps/api/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "mcp-postgres: missing ${ENV_FILE} (create from .env.example and set DATABASE_URL)" >&2
  exit 1
fi

# Read only DATABASE_URL; strip optional surrounding quotes.
DATABASE_URL="$(
  grep -E '^[[:space:]]*DATABASE_URL=' "${ENV_FILE}" | head -n1 | cut -d= -f2- \
    | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
)"

if [[ -z "${DATABASE_URL}" ]]; then
  echo "mcp-postgres: DATABASE_URL is empty in ${ENV_FILE}" >&2
  exit 1
fi

export DATABASE_URL
exec npx -y @fauzitech/mcp-postgres
