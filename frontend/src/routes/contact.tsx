import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/contact")({
  head: () => staticPageHead("contact"),
  component: renderStaticPage("contact"),
});
