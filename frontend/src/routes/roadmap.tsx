import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/roadmap")({
  head: () => staticPageHead("roadmap"),
  component: renderStaticPage("roadmap"),
});
