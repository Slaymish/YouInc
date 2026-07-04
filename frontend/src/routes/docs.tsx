import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/docs")({
  head: () => staticPageHead("docs"),
  component: renderStaticPage("docs"),
});
