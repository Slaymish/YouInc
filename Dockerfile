# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the TanStack Start frontend (vite build + nitro server).
# better-sqlite3's native binding is compiled here, on the same base image
# used at runtime, so the prebuilt binary is ABI-compatible at runtime.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend-build

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@10.33.0

WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 2: runtime image. Node runs the built Nitro server; Python (in a
# venv) backs the youinc_ledger CLI that the frontend shells out to for
# sync/reclassify/account-mapping operations.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-venv && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python package: only what's needed to run the CLI, not the dev/test extras.
COPY pyproject.toml README.md ./
COPY src ./src
COPY config ./config
RUN python3 -m venv /app/.venv && \
    /app/.venv/bin/pip install --upgrade pip && \
    /app/.venv/bin/pip install .

# Built frontend, including the Nitro server and its traced node_modules
# (e.g. better-sqlite3) from the build stage.
COPY --from=frontend-build /app/frontend/.output ./frontend/.output

COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV YOUINC_PROJECT_ROOT=/app \
    YOUINC_PYTHON=/app/.venv/bin/python \
    NODE_ENV=production \
    PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
