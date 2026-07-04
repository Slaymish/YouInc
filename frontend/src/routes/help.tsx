import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/help")({
  head: () => staticPageHead("help"),
  component: renderStaticPage("help"),
});
