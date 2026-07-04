import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/integrations")({
  head: () => staticPageHead("integrations"),
  component: renderStaticPage("integrations"),
});
