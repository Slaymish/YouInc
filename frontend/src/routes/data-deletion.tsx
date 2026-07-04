import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/data-deletion")({
  head: () => staticPageHead("data-deletion"),
  component: renderStaticPage("data-deletion"),
});
