import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/privacy")({
  head: () => staticPageHead("privacy"),
  component: renderStaticPage("privacy"),
});
