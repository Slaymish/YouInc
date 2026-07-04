import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/about")({
  head: () => staticPageHead("about"),
  component: renderStaticPage("about"),
});
