import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/status")({
  head: () => staticPageHead("status"),
  component: renderStaticPage("status"),
});
