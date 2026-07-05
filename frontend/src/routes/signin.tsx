import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for the multi-step sign-in flow (/signin, /signin/password). It
// is an explicit parent so the generated route tree stays stable in dev (an
// implicit/anonymous parent for index+child routes triggered a regeneration
// loop). Each step route owns its own loader/gate; this only provides the
// Outlet.
export const Route = createFileRoute("/signin")({
  component: () => <Outlet />,
});
