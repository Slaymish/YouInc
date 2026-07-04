import { createFileRoute } from "@tanstack/react-router";
import { renderStaticPage, staticPageHead } from "~/components/marketing/staticPageRoute";

export const Route = createFileRoute("/terms")({
  head: () => staticPageHead("terms"),
  component: renderStaticPage("terms"),
});
