import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/security")({
  head: () => staticPageHead("security"),
  component: renderStaticPage("security"),
});
