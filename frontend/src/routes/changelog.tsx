import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/changelog")({
  head: () => staticPageHead("changelog"),
  component: renderStaticPage("changelog"),
});
