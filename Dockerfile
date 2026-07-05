# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the TanStack Start frontend (vite build + nitro server).
# No native modules to compile (better-sqlite3 removed), so no python/make/g++.
# VITE_SUPABASE_* are inlined by Vite at build time, so they MUST arrive as
# build-args here (Fly runtime secrets would be too late). Both are public-safe
# (anon key is RLS-gated); baking them into the image is intended.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend-build

RUN npm install -g pnpm@10.33.0

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 2: runtime image. Node runs the built Nitro server. Stateless — no
# volume, no SQLite, all persistence is Supabase over the network.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

COPY --from=frontend-build /app/frontend/.output ./frontend/.output
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
