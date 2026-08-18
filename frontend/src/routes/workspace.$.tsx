import { createFileRoute } from "@tanstack/react-router";

// Match-only child so /workspace/* still resolves and the parent's redirect
// (routes/workspace.tsx) fires. Never renders.
export const Route = createFileRoute("/workspace/$")({
  component: () => null,
});
