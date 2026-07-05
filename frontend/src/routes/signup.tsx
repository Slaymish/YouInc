import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for the multi-step signup flow (/signup, /signup/name,
// /signup/credential, /signup/password). Explicit parent so the generated route
// tree stays stable in dev; each step route owns its own loader/gate.
export const Route = createFileRoute("/signup")({
  component: () => <Outlet />,
});
